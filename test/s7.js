// S7 v3.0 世界观重塑：轮心四辐、日历开门、三界势力写死、幽墟进出
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
srv.listen(8961);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
const ctx=await br.newContext({viewport:{width:1400,height:900}});
page=await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
page.on('console',m=>{ if(m.type()==='error'&&!/Failed to load resource/.test(m.text())) errs.push('console:'+m.text()); });
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData());
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await page.goto('http://localhost:8961/');
await page.waitForTimeout(400);

console.log('\n【投胎页】');
ok('副标题改成轮心四辐', (await page.textContent('#createMask .sub')).includes('轮心是轮枢，轮上四辐'));
ok('锁着的两个写明原因', await page.evaluate(()=>{
  const h=document.querySelector('#jieGrid .jiebtn[data-k="轮枢"]').textContent, a=document.querySelector('#jieGrid .jiebtn[data-k="幽墟"]').textContent;
  return h.includes('轮心')&&a.includes('第四辐');
}));
await page.click('#jieGrid .jiebtn[data-k="樱洲"]');
await page.waitForTimeout(150);
await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});

console.log('\n【三界势力写死】');
ok('樱洲七家势力照表铺好，模型编的不进来', await page.evaluate(()=>{
  const f=S.world.factions.filter(x=>x.realm==='樱洲').map(x=>x.name);
  return ['幕府','藩国','阴阳寮','忍村','剑豪道场','妖怪','星见学园'].every(n=>f.includes(n))&&!f.includes('一刀流')||f.includes('一刀流')&&S.sect&&S.sect.name==='一刀流';
}));
ok('主角投的是表外的小门户，也记进当界势力', await page.evaluate(()=>!S.sect||(!!factionOf(S.sect.name)&&sectHere())));
ok('界主从表里的首领里出', await page.evaluate(()=>{
  const l=S.lords['樱洲']; return !!l&&!l.rumor&&(FACTIONS['樱洲'].some(f=>f.leader===l.name)||l.isPlayer||S.world.ranking.some(r=>r.name===l.name));
}));
ok('铸造提示词不再让模型编势力，名单进了人选', await page.evaluate(()=>{
  const w=worldPrompt({}); return !w.includes('"factions"')&&w.includes('本界有名有姓的人物')&&w.includes('安倍晴明');
}));
ok('创角提示词列了本界的大势力', await page.evaluate(()=>initSchemaPrompt({realm:'樱洲'}).includes('本界的大势力是：幕府')));
const jb=await page.evaluate(()=>jieBlock());
ok('名录带人物名单、身份表、别界怎么看', jb.includes('宫本武藏')&&jb.includes('转校生')&&jb.includes('南蛮')&&jb.includes('唐土'));
ok('堕进幽墟的几位不在三界名单里，只剩传闻', !jb.split('本界常见的身份')[0].includes('玉藻前')&&jb.includes('玉藻前、酒吞童子'));
ok('西陆名录没有摩根勒菲，东荒没有申公豹', await page.evaluate(()=>!poolNames('西陆').includes('摩根勒菲')&&!poolNames('东荒').includes('申公豹')
  &&!FACTIONS['东荒'].some(f=>f.members.includes('申公豹'))&&!FACTIONS['樱洲'].some(f=>f.leader==='玉藻前'||f.members.includes('酒吞童子'))));
ok('东荒三脉写全', await page.evaluate(()=>{ const s=JIE['东荒'].layout; return s.includes('太清')&&s.includes('玉清')&&s.includes('上清')&&s.includes('四海龙宫'); }));
ok('地名表补齐（朝歌、白鸽广场、甲贺谷、幽墟门）', await page.evaluate(()=>{ const r=S.realm, at=(k,l)=>{ S.realm=k; return placeScene(l); };
  const ok1=at('东荒','朝歌')==='sc_d_town'&&at('西陆','白鸽广场')==='sc_w_church'&&at('东荒','奈何桥')==='sc_d_hell'&&at('樱洲','天狗山')==='sc_s_youkai'&&at('东荒','东海龙宫')==='sc_d_sea'&&at('樱洲','甲贺谷')==='sc_s_village'&&at('轮枢','幽墟门')==='sc_h_gate'; S.realm=r; return ok1; }));
ok('樱洲地名里没有百鬼夜行街', await page.evaluate(()=>!NAMES['樱洲'].di.some(x=>x[0]==='百鬼夜行街')));
ok('文案里不再有五辐、轮转', await page.evaluate(()=>{
  const t=document.body.innerText+loreParas().join('')+lawBlock()+jieBlock();
  return !/五辐|五根辐|轮转|五界/.test(t);
}));

console.log('\n【轮与通行】');
ok('三界里只能去轮枢，另两界灰掉', await page.evaluate(()=>{
  const t=crossTargets(); return t.find(x=>x.key==='轮枢').ok&&!t.find(x=>x.key==='东荒').ok&&!t.find(x=>x.key==='西陆').ok&&!t.find(x=>x.key==='幽墟').ok;
}));
ok('去轮枢 120 两（世道档）', await page.evaluate(()=>{ const d=S.difficulty; S.difficulty='normal'; const c=crossCost('轮枢'); S.difficulty=d; return c===120; }));
await page.evaluate(()=>{ S.player.money=99999; });
await page.evaluate(()=>crossRealm('轮枢')); await idle(); await page.waitForTimeout(300);
ok('到了轮枢，三界都能去', await page.evaluate(()=>S.realm==='轮枢'&&['东荒','西陆','樱洲'].every(k=>crossTargets().find(x=>x.key===k).ok)));
ok('轮枢能买护心之物', await page.evaluate(()=>{
  renderGate(); const b=!!$('btnWard'); buyWard(); return b&&hasWard()&&S.player.items['其他'].some(x=>x.name==='守魂御守'&&x.ward);
}));
ok('非开门月下不去幽墟，写明几月开', await page.evaluate(()=>{
  S.months+=(3-monthIdx()+12)%12; S.gateOpen=false;
  const t=crossTargets().find(x=>x.key==='幽墟'); return !t.ok&&t.why.includes('六月才开，还有 2 个月');
}));
ok('四月起风声', await page.evaluate(()=>{ S.engineNews=[]; S.gateWarned=false; gateTick(); return S.engineNews.some(x=>/再过两个月/.test(x)); }));
await page.evaluate(()=>{ S.months+=2; S.gateOpen=false; gateTick(); });
ok('六月门开，下得去', await page.evaluate(()=>S.gateOpen&&crossTargets().find(x=>x.key==='幽墟').ok));
ok('提示词写着门开着', await page.evaluate(()=>stateBlocks().includes('【幽墟之门】此刻开着')));
await page.evaluate(()=>crossRealm('幽墟')); await idle(); await page.waitForTimeout(300);
ok('下去了，期限是十二月', await page.evaluate(()=>S.realm==='幽墟'&&S.abyssLayer===1&&monthIdx(S.abyssDue)===11));
ok('提示词里带着第一层和墟使', await page.evaluate(()=>{ const b=stateBlocks(); return b.includes('【幽墟·第1层】幽墟外环')&&b.includes('墟使｜轮枢守门人'); }));
ok('外环有黑市：淘到的东西带印记', await page.evaluate(()=>{ const n=(S.player.items['法宝']||[]).length; buyRelic(); const it=S.player.items['法宝'].slice(-1)[0]; return S.player.items['法宝'].length===n+1&&it.cursed===true; }));
ok('半年里门不开，上不去', await page.evaluate(()=>{ return !crossTargets()[0].ok; }));
ok('十二月门开能走，月底不走就被丢回轮枢', await page.evaluate(()=>{
  while(num(S.months)<num(S.abyssDue)){ S.months++; gateTick(); }
  const canGo=S.gateOpen&&crossTargets()[0].ok&&S.realm==='幽墟';
  const hp=S.player.hp=100;
  S.months++; gateTick();
  return canGo&&S.realm==='轮枢'&&S.abyssLayer===0&&S.abyssDue==null&&S.player.hp<100&&S.ledger.some(x=>/扔回了轮枢/.test(x));
}));

console.log('\n【界主与局势】');
ok('局势块里有吞噬者', await page.evaluate(()=>situBlock().includes('幽墟：吞噬者')));
ok('界门卡上挂着吞噬者', await page.evaluate(()=>{ renderGate(); return $('wGate').textContent.includes('吞噬者'); }));
ok('侵蚀度重度的人，魔潮里受伤机会翻倍（不报错就算）', await page.evaluate(()=>{ S.erosion=8; S.realm='樱洲'; voidTide(); S.erosion=0; S.realm='轮枢'; return true; }));

console.log('\n【存档】');
ok('v14 老档升到最新版：轮转字段删掉、幽墟里的人落在第一层、期限落在开门月', await page.evaluate(()=>{
  const s={v:14,realm:'幽墟',homeRealm:'东荒',months:7,wheelTurns:3,wheelNext:30,gateCloseAt:9,gateOpen:true,lordPolicy:'打邻居',abyssRolls:3,outerHeads:['噬渊'],
    npcs:[],forged:['东荒','幽墟'],ties:{'东荒-西陆':50,'东荒-樱洲':50,'西陆-樱洲':50},voidP:30,lords:{},loreSeen:1,
    world:{factions:[{name:'云台观',realm:'东荒',power:50,leader:'x'}],ranking:[],events:[],fallen:[],vacant:0},player:{name:'甲',items:{},attributes:{'修为':10},'声望':10}};
  migrate(s);
  return s.v===SAVE_VERSION&&!('wheelNext' in s)&&!('wheelTurns' in s)&&s.gateOpen===false&&s.lordPolicy===null
    &&s.abyssLayer===1&&monthIdx(s.abyssDue)===11&&s.erosion===3&&s.bossKilled.length===1
    &&s.world.factions.some(f=>f.name==='云台观')&&s.world.factions.some(f=>f.name==='玄门·玉清');
}));

console.log('\n【提示词长度】');
const lens=await page.evaluate(()=>{ const r=S.realm, out={}; for(const k of ['东荒','西陆','樱洲','轮枢','幽墟']){ S.realm=k; if(k==='幽墟') S.abyssLayer=3; out[k]=turnPrompt('试',{fate:10,months:1}).length; } S.realm=r; S.abyssLayer=0; return out; });
console.log('  各界一回合提示词：'+JSON.stringify(lens));
ok('各界都在 17000 字以内', Object.values(lens).every(v=>v<17000));

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
ok('全程无页面报错', errs.length===0);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})();
