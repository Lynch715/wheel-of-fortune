// S21 换脸（规范 v3.7）：主角与 NPC 开局后换头像——图集任挑、上传自己的图、随天意、导出导入带图
// 用法：node test/s21.js（需 playwright；容器里用 PW_CHROME 指定 chromium）
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path'),os=require('os');
const {pickBody,sse,serve}=require('./mock');
const srv=http.createServer(serve);
const fails=[],oks=[];
const ok=(n,c)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n); };

// 一张 300×500 的竖图（PNG），给上传用：现场拼，不往测试里塞一大段 base64
const zlib=require('zlib');
function makePng(w,h){
  const crcT=[]; for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=c&1?0xedb88320^(c>>>1):c>>>1; crcT[n]=c>>>0; }
  const crc=b=>{ let c=0xffffffff; for(const x of b) c=crcT[(c^x)&255]^(c>>>8); return (c^0xffffffff)>>>0; };
  const ch=(t,d)=>{ const tb=Buffer.from(t), len=Buffer.alloc(4), cr=Buffer.alloc(4); len.writeUInt32BE(d.length); cr.writeUInt32BE(crc(Buffer.concat([tb,d]))); return Buffer.concat([len,tb,d,cr]); };
  const rows=Buffer.alloc((w*3+1)*h);
  for(let y=0;y<h;y++){ rows[y*(w*3+1)]=0; for(let x=0;x<w;x++){ const o=y*(w*3+1)+1+x*3; rows[o]=x*255/w|0; rows[o+1]=y*255/h|0; rows[o+2]=120; } }
  const ih=Buffer.alloc(13); ih.writeUInt32BE(w,0); ih.writeUInt32BE(h,4); ih[8]=8; ih[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(rows)),ch('IEND',Buffer.alloc(0))]);
}
const PNG=makePng(300,500);

(async()=>{
srv.listen(8981);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
const ctx=await br.newContext({viewport:{width:1400,height:900}});
const page=await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
let sent=[];
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData());
  sent.push(b.messages.map(m=>m.content).join('\n'));
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await page.goto('http://localhost:8981/'); await page.waitForTimeout(400);
await page.click('#jieGrid .jiebtn[data-k="东荒"]'); await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});
const ev=(f,a)=>(a===undefined?page.evaluate(f):page.evaluate(f,a));
const cellStyle=sel=>ev(s=>{ const e=document.querySelector(s); return e?e.getAttribute('style')||'':''; },sel);

console.log('【主角】');
await ev(()=>{ S.player.gender='男'; renderPanel(); });
const before=await ev(()=>({av:S.player.avatar, por:S.player.portrait}));
await page.click('#pFace');
ok('点面板上的自己头像，打开换脸框', await ev(()=>$('faceMask').classList.contains('on')));
ok('默认停在出身那一界（东荒）', await ev(()=>!!document.querySelector('#faceTabs button[data-t="d"].on')));
ok('当前那张框着', await ev(()=>{ const s=document.querySelector('#faceGrid .cell.sel'); return !!s&&s.dataset.a===S.player.avatar; }));
ok('性别预先筛成男', await ev(()=>!!document.querySelector('#faceTabs button[data-g="m"].on')&&[...document.querySelectorAll('#faceGrid .cell')].every(c=>c.dataset.a[2]==='m')));
await page.click('#faceTabs button[data-t="w"]');
ok('换到西陆那一页，全是 w 开头的格子', await ev(()=>[...document.querySelectorAll('#faceGrid .cell')].every(c=>c.dataset.a[0]==='w')));
await page.click('#faceTabs button[data-g="f"]');
const pick=await ev(()=>document.querySelector('#faceGrid .cell').dataset.a);
await page.click('#faceGrid .cell');
ok('点一格，底下出这一格的相貌', await ev(k=>$('faceNote').textContent.includes(avDesc(k).slice(0,6)),pick));
await page.click('#faceOk');
const after=await ev(()=>({av:S.player.avatar, pick:S.player.avatarPick, por:S.player.portrait, ap:S.player.appearance, open:$('faceMask').classList.contains('on')}));
ok('「用这张」以后：avatar 换了、记了手选、框关了', after.av===pick&&after.pick===true&&!after.open);
ok('主角的相貌文字（portrait 与 appearance）跟着换成新格子的描述', after.por===await ev(k=>avDesc(k),pick)&&after.ap===after.por);
ok('面板头像换成了新格子', (await cellStyle('#pFace .avatar')).includes(await ev(k=>avCellStyle(k).split('background-position:')[1].split(';')[0],pick)));

console.log('\n【NPC】');
await ev(()=>{ S.npcs=S.npcs.filter(n=>n.name!=='冷面客');
  S.npcs.push(normNpc({name:'冷面客',gender:'男',age:40,relation:'朋友',identity:'散修','好感度':30,'修为':50,faction:'散人',realm:'东荒',alignment:'中立'}));
  renderPanel(); showNpc(findNpc('冷面客')); $('npcMask').classList.add('on'); });
ok('人物卡上有「换脸」', await ev(()=>!!$('npcFaceBtn')));
await page.click('#npcFaceBtn');
ok('点了打开换脸框，标题写着他的名字', await ev(()=>$('faceMask').classList.contains('on')&&$('faceTitle').textContent.includes('冷面客')));
await page.click('#faceTabs button[data-t="x"]');
await ev(()=>{ const c=document.querySelector('#faceGrid .cell[data-a="x_elf"]')||document.querySelector('#faceGrid .cell'); c.click(); });
const xk=await ev(()=>faceCtx.sel);
await page.click('#faceOk');
const npc=await ev(()=>{ const n=findNpc('冷面客'); const img=document.querySelector('#npcMBody .npcpor'); const av=document.querySelector('#npcMBody .npchead .avatar');
  return {av:avSlotOf(n), por:n.portrait, modal:$('npcMask').classList.contains('on'), por_ok:img?img.getAttribute('src')===POR_IMG[avSlotOf(n)]:false, av_ok:av?(av.getAttribute('style')||'').includes(avCellStyle(avSlotOf(n)).split('background-position:')[1].split(';')[0]):false}; });
ok('NPC 换成了特型那一格', npc.av===xk);
ok('NPC 的相貌文字跟着换', npc.por===await ev(k=>avDesc(k),xk));
ok('人物卡还开着，而且重画成新脸（特型有立绘就出立绘）', npc.modal&&(npc.por_ok||npc.av_ok));
ok('长了一岁也不回到自动那张（手选钉死）', await ev(()=>{ const n=findNpc('冷面客'); n.age+=30; return avSlotOf(n); })===xk);
// 下一回合的提示词里用新相貌
sent=[];
await ev(()=>{ const n=findNpc('冷面客'); n.lastSeen=S.turn; });
await ev(()=>$('npcMask').classList.remove('on'));
await page.fill('#freeInput','去找冷面客喝酒'); await page.click('#sendBtn');
await page.waitForFunction(()=>!busy,null,{timeout:25000}).catch(()=>{}); await page.waitForTimeout(300);
ok('下一回合发出去的提示词里，他的相貌是新格子的描述', sent.join('\n').includes((await ev(k=>avDesc(k),xk)).slice(0,12)));

console.log('\n【幽墟头目】');
const boss=await ev(()=>{ const nm=Object.keys(BOSS_AV).find(k=>AV_SLOTS.indexOf(BOSS_AV[k])>=0);
  S.npcs=S.npcs.filter(n=>n.name!==nm);
  S.npcs.push(normNpc({name:nm,gender:'男',age:500,identity:'幽墟头目',faction:'幽墟头目',realm:'幽墟',alignment:'邪道'}));
  const n=findNpc(nm); const a=avSlotOf(n); setFace(n,'h2m_01'); return {nm, a, b:BOSS_AV[nm], now:avSlotOf(n)}; });
ok(`头目「${boss.nm}」原来走 BOSS_AV，手选以后不再被顶回去`, boss.a===boss.b&&boss.now==='h2m_01');
ok('头目「随天意」以后又回到 BOSS_AV 那张', await ev(nm=>{ const n=findNpc(nm); setFace(n,null); return avSlotOf(n); },boss.nm)===boss.b);

console.log('\n【随天意】');
const auto=await ev(()=>{ setFace(S.player,null); return {pick:!!S.player.avatarPick, av:S.player.avatar, por:S.player.portrait}; });
ok('主角随天意：手选记号清掉，回到按出身算的那张', !auto.pick&&auto.av===before.av);
ok('相貌文字也回去', auto.por===before.por);

console.log('\n【自己的图】');
const tmp=path.join(os.tmpdir(),'face_test.png'); fs.writeFileSync(tmp,PNG);
await ev(()=>{ showNpc(findNpc('冷面客')); $('npcMask').classList.add('on'); });
await page.click('#npcFaceBtn');
await page.click('#faceTabs button[data-t="u"]');
ok('「自己的图」那页第一格是加号', await ev(()=>!!document.querySelector('#faceGrid .cell.add')));
const [chooser]=await Promise.all([page.waitForEvent('filechooser'), page.click('#faceGrid .cell.add')]);
await chooser.setFiles(tmp);
await page.waitForFunction(()=>faceCtx&&/^u_/.test(faceCtx.sel||''),null,{timeout:8000}).catch(()=>{});
const up=await ev(()=>{ const f=FACES[faceCtx.sel]; if(!f) return null; return new Promise(r=>{ const im=new Image(); im.onload=()=>r({w:im.width,h:im.height,len:f.img.length,type:f.img.slice(5,15),desc:$('faceDescRow').style.display}); im.src=f.img; }); });
ok('上传的图裁成 160×160', !!up&&up.w===160&&up.h===160);
ok('压过以后很小（<30KB）', !!up&&up.len<30000);
ok('选中后露出相貌输入栏', !!up&&up.desc==='');
await page.fill('#faceDesc','三十来岁，瘦，穿灰袍，左眉一道疤');
await page.click('#faceOk');
const cu=await ev(()=>{ const n=findNpc('冷面客'); const f=FACES[n.face]; return {face:n.face, por:n.portrait, desc:f&&f.desc, img:f&&f.img, style:avatarFace(n), por2:porOf(n)}; });
ok('NPC 用上了自己的图', /^u_/.test(cu.face||'')&&!!cu.img&&cu.style.includes(cu.img));
ok('写的那句相貌进了 portrait，也记在图上', cu.por==='三十来岁，瘦，穿灰袍，左眉一道疤'&&cu.desc===cu.por);
ok('用自己的图就不出立绘', cu.por2===null);
ok('存档那一格里不带图', await ev(img=>!localStorage.getItem(LS_SAVE).includes(img.slice(30,90)),cu.img));
ok('图进了 IndexedDB', await ev(async id=>{ for(const k in FACES) delete FACES[k]; const n=await facesLoad(); return n>=1&&!!FACES[id]; },cu.face));

console.log('\n【导出 / 导入】');
const ex=await ev(()=>JSON.stringify(withFaces(S)));
ok('导出的存档带上了用到的图', ex.includes('"_faces"')&&ex.includes(cu.face));
// 换一个全新的浏览器（空 IndexedDB）导入
const ctx2=await br.newContext({viewport:{width:1400,height:900}});
const p2=await ctx2.newPage(); p2.on('pageerror',e=>errs.push(String(e)));
await p2.route('**/chat/completions',async route=>{ const b=JSON.parse(route.request().postData()); await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))}); });
await p2.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await p2.goto('http://localhost:8981/'); await p2.waitForTimeout(400);
const f2=path.join(os.tmpdir(),'face_save.json'); fs.writeFileSync(f2,ex);
await p2.setInputFiles('#importFile',f2); await p2.waitForTimeout(600);
const im=await p2.evaluate(([id,img])=>({has:!!FACES[id], face:(findNpc('冷面客')||{}).face, st:avatarFace(findNpc('冷面客')).includes(img), save:localStorage.getItem(LS_SAVE).includes('_faces')||localStorage.getItem(LS_SAVE).includes(img.slice(30,90))}),[cu.face,cu.img]);
ok('新设备导入：图回来了、NPC 头像还是那张', im.has&&im.face===cu.face&&im.st);
ok('导入后存档那一格里仍不带图', !im.save);
ok('新设备刷新一遍，图还在（进了它自己的 IndexedDB）', await (async()=>{ await p2.reload(); await p2.waitForTimeout(800); return p2.evaluate(([id,img])=>!!FACES[id]&&avatarFace(findNpc('冷面客')).includes(img),[cu.face,cu.img]); })());
await ctx2.close();

console.log('\n【图没了不开天窗】');
const gone=await ev(id=>{ const keep=FACES[id]; delete FACES[id]; const n=findNpc('冷面客'); const st=avatarFace(n); const face=n.face; FACES[id]=keep; return {st, face}; },cu.face);
ok('图没载到时退回图集那张，n.face 不被抹掉', !gone.st.includes(cu.img)&&gone.st.includes('background-position')&&gone.face===cu.face);
await ev(()=>{ showNpc(findNpc('冷面客')); $('npcMask').classList.add('on'); });
await page.click('#npcFaceBtn');
page.once('dialog',d=>d.accept());
await page.click('#faceDel');
const del=await ev(id=>({has:!!FACES[id], face:findNpc('冷面客').face, st:avatarFace(findNpc('冷面客'))}),cu.face);
ok('删掉这张图：图没了，用它的人换回原来的脸', !del.has&&!del.face&&!del.st.includes(cu.img));
await ev(()=>closeFace());

console.log('\n【老存档与回归】');
ok('老存档（没有 avatarPick / face）读进来脸不变', await ev(()=>{ const n=findNpc('冷面客'); delete n.avatarPick; delete n.face; n.avatar='d2m_01'; return avSlotOf(n)==='d2m_01'; }));
ok('mid 档照样能换（换脸不看自由度）', await ev(()=>{ fdSetAll('mid'); setFace(findNpc('冷面客'),'s2f_01'); return avSlotOf(findNpc('冷面客'))==='s2f_01'; }));

console.log('\n【手机 390】');
await page.setViewportSize({width:390,height:844});
await ev(()=>{ $('npcMask').classList.remove('on'); openFace(S.player); });
await page.waitForTimeout(200);
ok('换脸框不横向溢出', await ev(()=>document.documentElement.scrollWidth<=window.innerWidth+1&&$('faceModal').scrollWidth<=$('faceModal').clientWidth+1));
ok('格子至少 44px 好点', await ev(()=>{ const c=document.querySelector('#faceGrid .cell'); return c&&c.getBoundingClientRect().width>=44; }));

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
ok('全程无页面报错', errs.length===0);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})();
