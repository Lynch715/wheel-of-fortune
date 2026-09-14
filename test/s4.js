// S4 美术接入自测：图集落桶、特型命中、界徽、场景匹配、转轮出图、封面与图标
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const {pickBody,sse}=require('./mock');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'));
const srv=http.createServer((q,r)=>{ r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); r.end(html); });
const fails=[],oks=[];
const ok=(n,c)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n); };
let page;
const idle=()=>page.waitForFunction(()=>!busy&&(typeof convo==='undefined'||!convo),null,{timeout:25000});

(async()=>{
srv.listen(8935);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
const ctx=await br.newContext({viewport:{width:1400,height:900}});
page=await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
page.on('console',m=>{ if(m.type()==='error'&&!/Failed to load resource/.test(m.text())) errs.push('console:'+m.text()); });
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData());
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'deepseek-v4-flash',think:false})); });

console.log('\n【样张那一屏】');
await page.goto('http://localhost:8935/');
await page.evaluate(()=>{ $('createMask').classList.remove('on'); showDemo(); });
await page.waitForTimeout(500);
ok('封面画在样张顶上', await page.evaluate(()=>{const i=document.querySelector('.coverwrap img');return !!i&&i.naturalWidth>300;}));
ok('图标已换成美术出的那张', await page.evaluate(()=>($('appIcon').href||'').indexOf('data:image/png')===0));
await page.reload(); await page.waitForTimeout(400);

console.log('\n【转轮】');
ok('转轮用的是美术那张图', await page.evaluate(()=>{const i=$('wheelImg');return !!i&&i.naturalWidth>=400;}));
ok('五个扇形还在（当点击区）', (await page.$$('#wheelSvg .spoke')).length===5);
ok('图例五个，两个锁着', (await page.$$('#wheelLegend .wleg')).length===5 && (await page.$$('#wheelLegend .wleg.off')).length===2);
ok('角度表是从图上量出来的（东荒正上方，五个各不相同且顺时针递增）', await page.evaluate(()=>{
  const a=WHEEL_ANGLE; const v=['东荒','樱洲','幽墟','轮枢','西陆'].map(k=>a[k]);
  return a['东荒']===0 && v.every((x,i)=>i===0||x>v[i-1]) && v[4]<360 && new Set(v).size===5;
}));
ok('轮上不再糊遮罩（扇形只当点击区）', await page.evaluate(()=>
  Array.from(document.querySelectorAll('#wheelSvg .spoke')).every(p=>p.getAttribute('fill-opacity')==='0')));
await page.click('#wheelLegend .wleg[data-k="樱洲"]'); await page.waitForTimeout(200);
ok('点图例能选界', (await page.textContent('#wheelPick')).includes('樱洲'));
ok('选了樱洲，轮就转到那个角度', await page.evaluate(()=>$('wheelSpin').style.transform.includes('rotate(-'+WHEEL_ANGLE['樱洲'])));
await page.click('#wheelLegend .wleg[data-k="东荒"]'); await page.waitForTimeout(250);

console.log('\n【捏人挑相貌】');
ok('相貌可挑，摆的是东荒的脸', await page.evaluate(()=>{
  const cs=Array.from(document.querySelectorAll('#crAvatar .cell')).filter(c=>c.dataset.a);
  return cs.length>=8 && cs.every(c=>c.dataset.a[0]==='d');
}));
await page.click('#crGender button[data-v="女"]'); await page.waitForTimeout(200);
ok('选了女，只摆女相', await page.evaluate(()=>
  Array.from(document.querySelectorAll('#crAvatar .cell')).filter(c=>c.dataset.a).every(c=>c.dataset.a[2]==='f')));
await page.click('#crAvatar .cell:not(.auto)'); await page.waitForTimeout(200);
ok('挑了一张，底下写出那一张的说明', (await page.textContent('#crAvatarNote')).length>4);
const picked=await page.evaluate(()=>crSel.avatar);
ok('挑的脸会带进开局提示词（连年纪一档）', await page.evaluate(a=>{
  const p=initSchemaPrompt({avatar:a,gender:'女'});
  return p.includes('相貌已由玩家选定')&&p.includes(avDesc(a))&&p.includes('岁之间');
}, picked));
await page.click('#crGender button[data-v="随机"]'); await page.waitForTimeout(150);
await page.click('#wheelLegend .wleg[data-k="东荒"]'); await page.waitForTimeout(250);
await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});

console.log('\n【头像落桶】');
ok('图集是 10×9、82 张', await page.evaluate(()=>AV_COLS===10&&AV_ROWS===9&&AV_SLOTS.length===82));
ok('主角有画像且是东荒的桶', await page.evaluate(()=>/^d[1-4][mf]_0[12]$/.test(S.player.avatar)));
ok('面板上的脸用的是图集，不是墨影', await page.evaluate(()=>{
  const bg=document.querySelector('#pFace .avatar').style.backgroundImage||'';
  return bg.indexOf('data:image/webp')>=0;
}));
ok('沈师姐落进东荒女青年桶', await page.evaluate(()=>{
  const n=S.npcs.find(x=>x.name==='沈师姐'); return n&&/^d2f_0[12]$/.test(avSlotOf(n));
}));
ok('老掌教落进东荒男老年桶', await page.evaluate(()=>{
  const n=S.npcs.find(x=>x.name==='玄清真人'); return n&&/^d[34]m_0[12]$/.test(avSlotOf(n));
}));
ok('画像说明回灌给了模型', await page.evaluate(()=>stateBlocks().includes('主角画像')&&stateBlocks().includes('道袍')));

console.log('\n【特型命中】');
const sp=async(o)=>page.evaluate(n=>avPickSlot(n),o);
ok('真仙 → x_immortal', await sp({name:'甲',gender:'男',age:400,identity:'上仙',realm:'东荒'})==='x_immortal');
ok('骑士团长 → x_knight', await sp({name:'乙',gender:'男',age:50,identity:'骑士团长',realm:'西陆'})==='x_knight');
ok('阴阳师 → x_onmyoji', await sp({name:'丙',gender:'男',age:30,identity:'阴阳师',realm:'樱洲'})==='x_onmyoji');
ok('冒险者 → x_adventurer', await sp({name:'丁',gender:'男',age:30,identity:'冒险者',realm:'轮枢'})==='x_adventurer');
ok('八岁孩子 → x_child', await sp({name:'戊',gender:'女',age:8,identity:'女儿',realm:'东荒'})==='x_child');
ok('精灵 → x_elf', await sp({name:'己',gender:'女',age:120,identity:'精灵游侠',realm:'西陆'})==='x_elf');
ok('佣兵也算冒险者那一型', await sp({name:'庚',gender:'男',age:26,identity:'佣兵',realm:'西陆'})==='x_adventurer');
ok('寻常西陆青年落 w2m 桶', /^w2m_0[12]$/.test(await sp({name:'辛',gender:'男',age:26,identity:'铁匠',realm:'西陆'})));
ok('樱洲少女落 s1f 桶', /^s1f_0[12]$/.test(await sp({name:'壬',gender:'女',age:16,identity:'商家女儿',realm:'樱洲'})));
ok('同一个人每次同一张脸', await page.evaluate(()=>{
  const n={name:'某甲',gender:'男',age:30,identity:'散修',realm:'东荒'};
  return avPickSlot(n)===avPickSlot(Object.assign({},n));
}));

console.log('\n【界门说明】');
await page.evaluate(()=>openCross()); await page.waitForTimeout(250);
const gr=await page.textContent('.gaterule');
ok('过界弹窗里写了去干嘛', gr.includes('冒险者公会')&&gr.includes('跳板'));
ok('写了怎么过去（时机与门路）', gr.includes('两个月')&&gr.includes('价钱翻倍'));
ok('写了过去之后的代价', gr.includes('只剩五成')&&gr.includes('例银领不到')&&gr.includes('他自己凑盘缠也会追过来'));
ok('写了幽墟怎么下去怎么上来', gr.includes('引荐状')&&gr.includes('下来那一趟的两倍')&&gr.includes('幽墟不可投胎'));
await page.evaluate(()=>$('crossMask').classList.remove('on')); await page.waitForTimeout(150);

console.log('\n【场景横幅】');
ok('东荒山门 → 仙山', await page.evaluate(()=>{ S.scene.location='云台观山门'; return sceneKey()==='sc_d_peak'; }));
ok('东荒市镇 → 市镇', await page.evaluate(()=>{ S.scene.location='山下的镇子'; return sceneKey()==='sc_d_town'; }));
ok('界门不分界都用界门那张', await page.evaluate(()=>{ S.scene.location='界门之前'; return sceneKey()==='sc_h_gate'; }));
ok('樱洲学园 → 校舍', await page.evaluate(()=>{ const r=S.realm; S.realm='樱洲'; S.scene.location='星见学园的教室'; const k=sceneKey(); S.realm=r; return k==='sc_s_school'; }));
ok('西陆酒馆 → 酒馆', await page.evaluate(()=>{ const r=S.realm; S.realm='西陆'; S.scene.location='城里的酒馆'; const k=sceneKey(); S.realm=r; return k==='sc_w_tavern'; }));
ok('十八张场景都在', await page.evaluate(()=>Object.keys(SCENE_IMG).length===18));
await page.evaluate(()=>{ S.scene.location='云台观山门'; renderScene(); });
await page.waitForTimeout(300);
ok('正文区真的铺上了淡背景', await page.evaluate(()=>{
  const b=$('sceneBg');
  return b.classList.contains('on') && (b.style.backgroundImage||'').indexOf('data:image/webp')>=0
      && parseFloat(getComputedStyle(b).opacity)>0.1 && parseFloat(getComputedStyle(b).opacity)<0.6;
}));

console.log('\n【跑两回合】');
for(let i=0;i<2;i++){ await page.click('#choices .opt'); await idle(); await page.waitForTimeout(150); }
ok('两回合无页面报错', errs.length===0||console.log('    '+errs.slice(0,3).join(' | ')));
ok('缺图时仍退回墨影', await page.evaluate(()=>
  avCellStyle('这张不存在')===null && inkFace({name:'无名',gender:'男',age:30}).indexOf('svg')>0));

console.log('\n【手机 390×844】');
await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(400);
ok('无横向溢出', !(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1)));
await page.screenshot({path:path.join(__dirname,'s4-phone.png')});
await page.setViewportSize({width:1400,height:900}); await page.waitForTimeout(200);
await page.screenshot({path:path.join(__dirname,'s4-desk.png')});
await page.evaluate(()=>{ localStorage.removeItem('wanjie_save_v1'); });
await page.evaluate(()=>{ S=null; openCreate(); document.querySelector('#createMask .modal').scrollTop=0; }); await page.waitForTimeout(600);
await page.screenshot({path:path.join(__dirname,'s4-wheel.png')});

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
await br.close(); srv.close();
process.exit(fails.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
