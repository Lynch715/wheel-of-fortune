// S2 五辐自测：一局里换两次界，核对名录、纪年、称呼、境界、分层记忆、榜的按界过滤
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const {pickBody,sse,serve}=require('./mock');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'));
const srv=http.createServer(serve);
const fails=[],oks=[];
const ok=(n,c)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n); };
let page;
const idle=()=>page.waitForFunction(()=>!busy&&(typeof convo==='undefined'||!convo),null,{timeout:25000});
const LEAK={
  '东荒':['魔法','魔力','魔导','斗气','骑士','教廷','咒力','式神','阴阳师','忍者','阁下'],
  '西陆':['金丹','元婴','化神','道友','仙子','灵气','符箓','咒力','式神','幕府','忍者'],
  '樱洲':['魔法','魔力','魔导','斗气','骑士','教廷','阁下','金丹','元婴','道友','仙子'],
  '轮枢':[]
};
const body=async()=>page.evaluate(()=>Array.from(document.querySelectorAll('#story .ntext')).map(e=>e.textContent).join('\n'));

(async()=>{
srv.listen(8933);
const exe=process.env.PW_CHROME||undefined;
const br=await chromium.launch(exe?{executablePath:exe}:{});
const ctx=await br.newContext({viewport:{width:1400,height:900}});
page=await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
page.on('console',m=>{ if(m.type()==='error') errs.push('console:'+m.text()); });
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData());
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'deepseek-v4-flash',think:false})); });
await page.goto('http://localhost:8933/');

console.log('\n【轮上三辐可停】');
ok('能投胎的三个', (await page.$$('#jieGrid .jiebtn:not(.off)')).length===3);
ok('轮枢与幽墟写明只能去不能投', (await page.textContent('#jieGrid')).includes('只能去') && (await page.$$('#jieGrid .jiebtn.off')).length===2);
await page.click('#jieGrid .jiebtn[data-k="西陆"]');
await page.waitForTimeout(200);
ok('点了可选西陆', (await page.textContent('#jieGrid .jiebtn.sel')).includes('西陆'));
ok('出身表换成西陆的', (await page.textContent('#bgGrid')).includes('魔法塔学徒'));
await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});

console.log('\n【西陆一局】');
ok('界徽是✠', (await page.textContent('#jieSeal'))==='✠');
ok('纪年是王国历', (await page.textContent('#gameDate')).includes('王国历'));
ok('主修落在面板上', (await page.textContent('#pPath')).includes('斗气'));
ok('境界按斗气那条路排', /一阶|二阶|三阶|四阶|五阶/.test(await page.textContent('#pAttrs')));
ok('悟性标成天赋', (await page.textContent('#pAttrs')).includes('天赋'));
ok('位阶按骑士团翻', /侍从|见习骑士|骑士|队长/.test(await page.textContent('#pSect')));
// 「本界之禁」那一行本来就要点名别界的词，查泄漏时把它剔掉
const noBan=t=>t.split('\n').filter(l=>l.indexOf('- 本界之禁')!==0).join('\n');
let jb=noBan(await page.evaluate(()=>jieBlock()));
ok('名录是西陆的，不带东荒', jb.includes('魔法塔')&&!jb.includes('金丹')&&!jb.includes('万妖山'));
ok('名录写明主修那一条', jb.includes('主修「斗气」')&&jb.includes('这一套跟着他走，到哪一界都不变'));
ok('西陆不按姓称呼', (await page.evaluate(()=>nameRule(S.player))).includes('全名'));
for(let i=0;i<2;i++){ await page.click('#choices .opt'); await idle(); }
let bd=await body();
let lk=LEAK['西陆'].filter(w=>bd.includes(w));
ok('西陆正文无跨界泄漏'+(lk.length?'（'+lk.join('、')+'）':''), lk.length===0);
ok('功法词卫按西陆换词', await page.evaluate(()=>normArt({name:'金丹一击',desc:'以灵气为引',style:'刚猛',level:20}).name==='高阶一击'));

console.log('\n【幽墟之门按日历开】');
ok('界门卡在万界页签上', (await page.textContent('#wGate')).includes('幽墟之门'));
ok('轮转那一套彻底没了', await page.evaluate(()=>typeof wheelTick==='undefined'&&typeof wheelPeriod==='undefined'&&!('wheelNext' in S)&&!('wheelTurns' in S)));
ok('只有六月、十二月是开门月', await page.evaluate(()=>[0,1,2,3,4,5,6,7,8,9,10,11].filter(m=>isGateMonth(m)).join()==='5,11'));
await page.evaluate(()=>{ S.gateOpen=false; while(!isGateMonth(S.months+1)) S.months++; });
const before=false;
await page.click('#choices .opt'); await idle();
ok('时间走到开门月，门开了（这一回合若走了好几个月，门可能已经又合上，所以看账）', !before && await page.evaluate(()=>S.gateOpen===true||S.ledger.some(x=>x.includes('幽墟之门开'))));
ok('开门记进了账', await page.evaluate(()=>S.ledger.some(x=>x.includes('幽墟之门开'))));
ok('三界之间不直达，要经轮枢', await page.evaluate(()=>{ const t=crossTargets(); const e=t.find(x=>x.key==='东荒'); const h=t.find(x=>x.key==='轮枢'); return !!e&&e.ok===false&&e.why.includes('先去轮枢')&&h.ok===true; }));
ok('异界来客/风声写进了引擎消息或旧账', await page.evaluate(()=>S.ledger.concat(S.engineNews||[]).some(x=>/异界来客|幽墟/.test(x))));

console.log('\n【过界到轮枢】');
const before2=await page.evaluate(()=>({m:S.player.money,n:S.npcs.length}));
await page.evaluate(()=>openCross());
ok('过界弹窗列出可去之处', (await page.$$('#crossList .crossopt')).length>=1);
await page.evaluate(()=>crossRealm('轮枢'));
await idle(); await page.waitForTimeout(400);
ok('已到轮枢', await page.evaluate(()=>S.realm==='轮枢'));
ok('界徽换成◎', (await page.textContent('#jieSeal'))==='◎');
ok('出身界仍记着西陆', await page.evaluate(()=>S.homeRealm==='西陆'));
ok('过界花了钱', await page.evaluate(m=>S.player.money<m, before2.m));
ok('通行证用掉了', await page.evaluate(()=>!(S.player.items['其他']||[]).some(x=>/通行证/.test(x.name))));
ok('过界记进了旧账', await page.evaluate(()=>S.ledger.some(x=>x.includes('过界到轮枢'))));
jb=noBan(await page.evaluate(()=>jieBlock()));
ok('轮枢名录里有公会与神殿', jb.includes('冒险者公会')&&jb.includes('命运神殿'));
ok('轮枢没有自己的体系，境界仍按西陆的路子算', await page.evaluate(()=>/一阶|二阶|三阶|四阶|五阶|六阶/.test(tierOf(S.player.attributes['修为']))));
ok('西陆的旧识落进「别处的旧识」', await page.evaluate(()=>{const p=stateBlocks();const i=p.indexOf('【别处的旧识');const j=p.indexOf('【已亡故');return p.slice(i,j).includes('远在西陆');}));
ok('轮枢铸了自己的格局', await page.evaluate(()=>(S.forged||[]).includes('轮枢')&&S.world.factions.some(f=>f.realm==='轮枢')));
ok('势力格局只列当界的', await page.evaluate(()=>localFactions().every(f=>f.realm==='轮枢')));
ok('万界榜上别界的人带界名', await page.evaluate(()=>S.world.ranking.some(r=>r.realm==='西陆')));

console.log('\n【过界到樱洲】');
await page.evaluate(()=>crossRealm('樱洲'));
await idle(); await page.waitForTimeout(400);
ok('已到樱洲', await page.evaluate(()=>S.realm==='樱洲'));
ok('纪年换成年号', !/王国历|万界历/.test(await page.textContent('#gameDate')));
jb=noBan(await page.evaluate(()=>jieBlock()));
ok('樱洲名录带学园与同学', jb.includes('星见学园')&&jb.includes('同学'));
ok('名录点明主角是西陆来的异界人', jb.includes('西陆来的异界人'));
ok('异界适应不再动先天悟性', await page.evaluate(()=>foreignPenalty().wit===undefined));
ok('刚过界一年内：修炼×0.5、月耗×1.45', await page.evaluate(()=>{const f=foreignPenalty();return f.grow===0.5&&f.cost===1.45;}));
ok('满一年之后松到 ×0.7 / ×1.25', await page.evaluate(()=>{
  const b=S.foreignFrom; S.foreignFrom=S.months-20; const f=foreignPenalty(); S.foreignFrom=b;
  return f.grow===0.7&&f.cost===1.25;
}));
ok('月耗真的吃了这个系数', await page.evaluate(()=>{
  const r=S.realm; const a=upkeepPerMonth(); S.realm=S.homeRealm; const b=upkeepPerMonth(); S.realm=r;
  return a>b;
}));
ok('出生界的境界名跨界不变', await page.evaluate(()=>{
  const r=S.realm, t1=tierOf(S.player.attributes['修为']);
  S.realm='东荒'; const t2=tierOf(S.player.attributes['修为']);
  S.realm='轮枢'; const t3=tierOf(S.player.attributes['修为']); S.realm=r;
  return t1===t2&&t2===t3&&pathOf()==='斗气';
}));
ok('师门远在别界，例银领不到', await page.evaluate(()=>!sectHere()&&sectStipend()===0));
await page.click('#choices .opt'); await idle();
bd=await body();
lk=LEAK['樱洲'].filter(w=>bd.includes(w));
ok('全程正文无当界不该有的词'+(lk.length?'（'+lk.join('、')+'）':''), lk.length===0);
ok('故事没断：旧账里三个界都在', await page.evaluate(()=>{const t=S.ledger.join('|');return t.includes('西陆')&&t.includes('轮枢')&&t.includes('樱洲');}));
ok('换过两次界', await page.evaluate(()=>(S.realmLog||[]).length>=3));

console.log('\n【榜的按界过滤】');
await page.evaluate(()=>{ S.gateOpen=false; S.gateCloseAt=-1; S.lastChallengeMonth=-99; });
const far=await page.evaluate(()=>{const r=(S.world.ranking||[]).find(x=>x.realm&&x.realm!==jieName()&&x.alive!==false);return r?r.name:null;});
ok('榜上有别界的人可挑', !!far);
if(far){
  await page.evaluate(n=>challengeRanked(n), far);
  await page.waitForTimeout(400);
  ok('界门未开时挑不了别界的人', !(await page.evaluate(()=>!!(typeof duel!=='undefined'&&duel))));
}

console.log('\n【名号表】');
ok('每界的候选名都合本界的拼法', await page.evaluate(()=>{
  const d=nameCandidates('东荒',8), w=nameCandidates('西陆',8), s=nameCandidates('樱洲',8);
  return d.every(x=>!/·/.test(x)) && w.every(x=>/·/.test(x)||x.length<=3) && w.some(x=>/·/.test(x))
      && s.every(x=>!/·/.test(x));
}));
ok('候选名不跟已登场的人重', await page.evaluate(()=>{
  const used=new Set(S.npcs.map(n=>n.name).concat([S.player.name]));
  return nameCandidates(jieName(),8).every(x=>!used.has(x));
}));
ok('名录里写了起名路数与例子', await page.evaluate(()=>/人物起名：/.test(jieBlock())));
ok('名录里列了本界的去处', await page.evaluate(()=>jieBlock().includes('本界常见的去处')));
ok('判定块每回合发候选名', await page.evaluate(()=>judgeBlock({fate:10,months:1}).includes('名字从这几个里挑')));
ok('地名表里的地名直接对上横幅', await page.evaluate(()=>{
  const r=S.realm, l=S.scene.location;
  S.realm='西陆'; S.scene.location='断斧旅店后院'; const k=sceneKey();
  S.realm='樱洲'; S.scene.location='星见学园中庭'; const k2=sceneKey();
  S.realm=r; S.scene.location=l;
  return k==='sc_w_tavern' && k2==='sc_s_school';
}));
ok('提示词没胖失控（开局那回 <16800 字；v3.3 起万界榜开局就是满榜十人）', await page.evaluate(()=>turnPrompt('试试',{fate:10,months:1}).length<16800));

console.log('\n【v1.1 口径】');
ok('轮枢随时可去，不看轮转', await page.evaluate(()=>{
  const g=S.gateOpen; S.gateOpen=false;
  const t=crossTargets().find(x=>x.key==='轮枢'); S.gateOpen=g;
  return !!t&&t.ok===true;
}));
ok('过界说明只留两句，写明可以借轮枢中转', await page.evaluate(()=>{ openCross(); const t=document.querySelector('.gaterule').textContent; $('crossMask').classList.remove('on'); return t.includes('经轮枢转')&&t.includes('六月、十二月')&&t.length<130; }));
ok('仇家隔着界恨涨得慢，不是冻住', await page.evaluate(()=>{
  const n=S.npcs[0]; n.realm='东荒'; S.realm='樱洲';
  S.vendettas=[{name:n.name,reason:'试',heat:10,cool:0}];
  tickVendettas(3);
  return S.vendettas[0].heat>10&&S.vendettas[0].heat<20;
}));
ok('恨满了他自己花钱追过界，且提前给风声', await page.evaluate(()=>{
  const n=S.npcs[0];
  S.vendettas=[{name:n.name,reason:'试',heat:95,cool:0}]; n.realm='东荒'; S.realm='樱洲'; S.engineNews=[];
  tickVendettas(1);
  const warned=(S.engineNews||[]).some(x=>/打听你的去处/.test(x));
  tickVendettas(1);
  return warned && n.realm==='樱洲' && S.ledger.some(x=>/自费过界/.test(x));
}));
ok('词卫不动已登记的功法名', await page.evaluate(()=>{
  const a=normArt({name:'金丹诀',desc:'以灵气为引',style:'刚猛',level:20},'东荒');
  const r=S.realm; S.realm='西陆';
  const again=normArt(a); S.realm=r;
  return a.name==='金丹诀'&&again.name==='金丹诀'&&a.from==='东荒';
}));
ok('新起的本界功法仍按来源换词', await page.evaluate(()=>normArt({name:'金丹一击',style:'刚猛',level:20},'西陆').name==='高阶一击'));
ok('模型改不动年龄', await page.evaluate(()=>{
  const before=S.player.age;
  applyTurn({narrative:'x',summary:'x',playerChanges:{age:before+30}},'试',{fate:10,months:0});
  return S.player.age===before;
}));
ok('NPC 的年龄模型也改不动', await page.evaluate(()=>{
  const n=S.npcs[0], before=n.age;
  applyTurn({narrative:'x',summary:'x',npcUpdates:[{name:n.name,age:before+30}]},'试',{fate:10,months:0});
  return n.age===before && !turnPrompt('试',{fate:10,months:1}).includes('"age":null');
}));
ok('老存档升到 v9：功法物件补上来路', await page.evaluate(()=>{
  const s={v:8,realm:'樱洲',homeRealm:'西陆',realmSince:12,months:30,npcs:[],
    player:{arts:[{name:'旧诀',desc:'',style:'刚猛',level:10}],items:{'其他':[{name:'旧物'}]}}};
  migrate(s);
  return s.v>=9 && s.player.arts[0].from==='西陆'
      && s.player.items['其他'][0].from==='西陆' && s.foreignFrom===12;
}));
ok('风闻固定两条', await page.evaluate(()=>turnPrompt('试',{fate:10,months:1}).includes('rumors**固定写两条**')));
ok('随心所欲档写明不得推翻已成定局', await page.evaluate(()=>FREEDOM.free.tone.includes('已经成了定局的事')&&FREEDOM.free.tone.includes('不能当那件事没发生过')));
ok('三档都写了「尝试 vs 结果」', await page.evaluate(()=>
  FREEDOM.free.tone.includes('尝试')&&FREEDOM.mid.tone.includes('不决定成败')&&FREEDOM.strict.tone.includes('不是结果')));
ok('判定尺子三处同一套', await page.evaluate(()=>{
  const a=judgeHowTo(10);
  return a.includes('40 容易')&&a.includes('气运加成')&&a.includes('掷 20 必成')
      && judgeBlock({fate:10,months:1}).includes('40 容易');
}));
ok('幽墟仍不可投胎：那个按钮是锁着的', await page.evaluate(()=>{
  const sp=document.querySelector('#jieGrid .jiebtn[data-k="幽墟"]');
  return !!sp && sp.classList.contains('off');
}));
ok('人不在轮枢时幽墟下不去', await page.evaluate(()=>{
  const g=S.gateOpen; S.gateOpen=true;
  const t=crossTargets().find(x=>x.key==='幽墟'); S.gateOpen=g;
  return !!t&&t.ok===false&&t.why.includes('得先到轮枢');
}));
ok('公会字母等级进了白名单', await page.evaluate(()=>lawBlock().includes('F/D/C/B/A/S')));
ok('现实宗教与小说人物放开（v3.0）', await page.evaluate(()=>{
  const l=lawBlock();
  return l.includes('小说里的角色可以写进来')&&!l.includes('换了名字的影子')&&l.includes('可以有阴谋暗线');
}));
ok('表字爵位绰号可用但不可现编', await page.evaluate(()=>lawBlock().includes('不可现编一个面板上没有的')));

console.log('\n【手机 390×844】');
await page.setViewportSize({width:390,height:844});
await page.waitForTimeout(300);
ok('无横向溢出', !(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1)));
await page.evaluate(()=>{ setDrawer(true); document.querySelector('[data-tab="world"]').click(); });
await page.waitForTimeout(300);
await page.screenshot({path:path.join(__dirname,'s2-gate.png')});
await page.setViewportSize({width:1400,height:900}); await page.waitForTimeout(200);
await page.screenshot({path:path.join(__dirname,'s2-desk.png')});

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
ok('全程无页面报错', errs.length===0);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
