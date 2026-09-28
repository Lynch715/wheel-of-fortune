// S24 存档搬进 IndexedDB：localStorage 满了照样存得上、老档自动搬家、存不上挂红条、读档对账
// 用法：node test/s24.js（需 playwright；容器里用 PW_CHROME 指定 chromium）
const {chromium}=require('playwright');
const http=require('http');
const {pickBody,sse,serve}=require('./mock');
const srv=http.createServer(serve);
const fails=[],oks=[];
const ok=(n,c)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n); };

(async()=>{
srv.listen(8984);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
const ctx=await br.newContext({viewport:{width:1400,height:900}});
const page=await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
page.on('dialog',d=>d.accept().catch(()=>{}));
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData());
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
const ev=(f,a)=>(a===undefined?page.evaluate(f):page.evaluate(f,a));
const idle=()=>page.waitForFunction(()=>!busy&&(typeof convo==='undefined'||!convo),null,{timeout:25000});
// 挑一条不打架的选项走一回：比武弹窗会把后面的点击挡住
const turn=async()=>{ await ev(()=>{ const o=(S.lastOptions||[]).find(x=>x.type!=='duel'&&x.type!=='talk')||{text:'就地歇一口气',type:'rest',days:3}; act(o.text,o); }); await page.waitForTimeout(200); await idle(); await page.waitForTimeout(300); };
const settle=()=>page.waitForFunction(()=>!saveBusy&&saveQ==null,null,{timeout:5000});
const reload=async()=>{ await page.reload(); await page.waitForFunction(()=>typeof S!=='undefined'&&S&&S.player,null,{timeout:10000}); await page.waitForTimeout(500); };

await page.goto('http://localhost:8984/'); await page.waitForTimeout(400);
await page.click('#jieGrid .jiebtn[data-k="东荒"]'); await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});
await idle();

console.log('【正常存】');
await turn(); await settle();
ok('主档进了 IndexedDB', await ev(async()=>{ const r=JSON.parse(await kvGet('main')); return r&&r.turn===S.turn; }));
ok('localStorage 里不再有主档', await ev(()=>localStorage.getItem(LS_SAVE)===null));

console.log('【localStorage 塞满】');
await ev(()=>{ window.__ls=Storage.prototype.setItem; Storage.prototype.setItem=function(){ throw new DOMException('full','QuotaExceededError'); }; });
await turn(); await turn(); await settle();
const t1=await ev(()=>S.turn);
ok('塞满以后照样存上，没挂红条', await ev(()=>!document.getElementById('saveWarn')));
await reload();
ok('刷新后回合数对得上（第 '+t1+' 回）', await ev(t=>S.turn===t,t1));
ok('选项还是最后一回的', await ev(()=>document.querySelectorAll('#choices .opt').length>0));
ok('没有误报「存档没接上」', await ev(()=>!$('story').textContent.includes('存档没接上')));

console.log('【存不上】');
await ev(()=>{ window.__kv=kvPut; kvPut=()=>Promise.reject(new Error('x')); Storage.prototype.setItem=function(){ throw new DOMException('full','QuotaExceededError'); }; });
await turn(); await page.waitForTimeout(300);
ok('两边都存不上：顶上挂红条', await ev(()=>!!document.getElementById('saveWarn')));
ok('红条里有导出按钮', await ev(()=>!!document.querySelector('#saveWarn button')));
ok('章节没被偷偷砍掉', await ev(()=>(S.chapters||[]).length>0));
await ev(()=>{ kvPut=window.__kv; saveGame(); }); await settle();
ok('存上以后红条自己消失', await ev(()=>!document.getElementById('saveWarn')));

console.log('【对账：存档停在前面，全本多出两章】');
const tSaved=await ev(()=>S.turn);
await ev(()=>{ kvPut=()=>Promise.reject(new Error('x')); });   // 接下来两回写得出正文、存不上
await turn(); await turn(); await page.waitForTimeout(300);
await reload();   // 存不上的状态跟着旧页面一起没了，刷新后是干净的
ok('读回的是存上的那一回（第 '+tSaved+' 回）', await ev(t=>S.turn===t,tSaved));
await page.waitForTimeout(600);
ok('正文底下写着「存档没接上」', await ev(()=>$('story').textContent.includes('存档没接上')));
ok('说清是 2 章', await ev(()=>/之后还写了 2 章/.test($('story').textContent)));
ok('提示里带导出按钮', await ev(()=>[...document.querySelectorAll('#story button')].some(b=>b.textContent.includes('导出这 2 章'))));
ok('那两章挪走了，本局全本只剩存上的', await ev(async()=>(await bookAll(S.runId)).every(r=>r.seq<=S.chapSeq)));
ok('挪到的地方还找得到（run 名带 ~lost）', await ev(async()=>{ const db=await idb(); return new Promise(res=>{ const rq=db.transaction(IDB_STORE).objectStore(IDB_STORE).getAll(); rq.onsuccess=()=>res(rq.result.filter(r=>/~lost/.test(r.run)).length===2); }); }));
await turn(); await settle();
await reload(); await page.waitForTimeout(600);
ok('接着玩一回再刷新，不再重复提示', await ev(()=>!$('story').textContent.includes('存档没接上')));

console.log('【老档搬家】');
const legacy=await ev(()=>{ const d=JSON.parse(JSON.stringify(S)); d.turn=77; delete d.savedAt; return JSON.stringify(d); });
await ev(async l=>{ S=null; await kvDel('main'); localStorage.setItem('wanjie_save_v1',l); localStorage.setItem('wanjie_slot_2',l); },legacy);
await reload(); await settle(); await page.waitForTimeout(300);
ok('只有 localStorage 里有老档：照样读出来', await ev(()=>S.turn===77));
ok('读完搬进 IndexedDB', await ev(async()=>JSON.parse(await kvGet('main')).turn===77));
ok('搬完 localStorage 里的主档删了', await ev(()=>localStorage.getItem('wanjie_save_v1')===null));
ok('存档位 2 也搬了', await ev(async()=>!!(await kvGet('slot2'))&&localStorage.getItem('wanjie_slot_2')===null&&slotMeta(2).turn===77));

console.log('【两边都有，谁新用谁】');
await ev(async()=>{ const cur=S; S=null; const d=JSON.parse(JSON.stringify(cur)); d.turn=5; d.savedAt=1; await kvPut('main',JSON.stringify(d)); const e=JSON.parse(JSON.stringify(cur)); e.turn=9; e.savedAt=Date.now()+99999; localStorage.setItem('wanjie_save_v1',JSON.stringify(e)); });
await reload(); await settle();
ok('localStorage 那份更新：用它', await ev(()=>S.turn===9));

console.log('【存档位】');
await page.click('#btnExport'); await page.waitForTimeout(200);
await page.click('button[data-sv="1"]'); await page.waitForTimeout(400);
ok('存入存档位 1', await ev(async()=>!!(await kvGet('slot1'))&&slotMeta(1).turn===S.turn));
await ev(()=>{ S.turn=123; saveGame(); }); await settle();
await page.click('button[data-ld="1"]'); await page.waitForTimeout(400);
ok('读存档位 1 回到存入时那一回', await ev(()=>S.turn===9));
await settle();
ok('读完主档也跟着换了', await ev(async()=>JSON.parse(await kvGet('main')).turn===9));
await page.click('#btnExport'); await page.waitForTimeout(200);
await page.click('button[data-dl="1"]'); await page.waitForTimeout(400);
ok('清空存档位 1', await ev(async()=>!(await kvGet('slot1'))&&!slotMeta(1)));

console.log('【另起一局】');
await ev(()=>{ $('saveMask').classList.remove('on'); S=null; saveWipe(); }); await page.waitForTimeout(300);
ok('主档清掉', await ev(async()=>!(await kvGet('main'))&&localStorage.getItem('wanjie_save_v1')===null));

ok('全程无页面报错', errs.length===0);
if(errs.length) console.log(errs.join('\n'));
console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
await br.close(); srv.close(); process.exit(fails.length?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
