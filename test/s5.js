// S5 幽墟专测：进出的路、境内的险、侵蚀、幽墟器物、名录半套、跨界宿命、v10 迁移
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const {pickBody,sse}=require('./mock');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'));
const srv=http.createServer((q,r)=>{ r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); r.end(html); });
const fails=[],oks=[];
const ok=(n,c)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n); };
let page;
const idle=()=>page.waitForFunction(()=>!busy&&(typeof convo==='undefined'||!convo),null,{timeout:25000});
// 幽墟自己没有体系词，别界的一个都不许漏进正文
const LEAK_ABYSS=['金丹','元婴','化神','道友','仙子','灵气','符箓','魔法','魔力','魔导','骑士','教廷','咒力','式神','阴阳师','忍者','幕府'];
const body=async()=>page.evaluate(()=>Array.from(document.querySelectorAll('#story .ntext')).map(e=>e.textContent).join('\n'));

(async()=>{
srv.listen(8935);
const exe=process.env.PW_CHROME||undefined;
const br=await chromium.launch(exe?{executablePath:exe}:{});
const ctx=await br.newContext({viewport:{width:1400,height:900}});
page=await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
page.on('console',m=>{ if(m.type()==='error'&&!/Failed to load resource/.test(m.text())) errs.push('console:'+m.text()); });
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData());
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'deepseek-v4-flash',think:false})); });
await page.goto('http://localhost:8935/');

console.log('\n【轮上仍然锁着】');
ok('能投胎的还是三个，幽墟不在其中', await page.evaluate(()=>
  Array.from(document.querySelectorAll('#jieGrid .jiebtn:not(.off)')).every(e=>e.dataset.k!=='幽墟')
  && document.querySelectorAll('#jieGrid .jiebtn:not(.off)').length===3));
ok('幽墟那个按钮写明只能去', (await page.textContent('#jieGrid .jiebtn[data-k="幽墟"]')).includes('只能去'));

await page.click('#jieGrid .jiebtn[data-k="西陆"]');
await page.waitForTimeout(200);
await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});

console.log('\n【下不去的时候】');
ok('人在西陆：幽墟根本不在过界清单里出现可去的样子', await page.evaluate(()=>{
  S.gateOpen=true;
  const t=crossTargets().find(x=>x.key==='幽墟');
  return !!t && t.ok===false && t.why.includes('得先到轮枢');
}));

console.log('\n【先到轮枢】');
await page.evaluate(()=>{ S.player.money=6000; S.gateOpen=true; });
await page.evaluate(()=>crossRealm('轮枢'));
await idle(); await page.waitForTimeout(400);
ok('已到轮枢', await page.evaluate(()=>S.realm==='轮枢'));
ok('头一回跨界就背上了那桩跨界宿命', await page.evaluate(()=>
  (S.quests||[]).some(q=>q.kind==='abyss'&&q.status==='进行中')));
ok('门没开时幽墟仍下不去', await page.evaluate(()=>{
  S.gateOpen=false;
  const t=crossTargets().find(x=>x.key==='幽墟');
  return !!t&&t.ok===false&&/才开，还有 \d+ 个月/.test(t.why);
}));
ok('门开了就下得去，价钱是常规那趟的三倍', await page.evaluate(()=>{
  S.gateOpen=true; S.gateCloseAt=S.months+2;
  const t=crossTargets().find(x=>x.key==='幽墟');
  return !!t&&t.ok===true&&t.cost===360;
}));
ok('普通通行证下不了幽墟', await page.evaluate(()=>{
  S.player.items['其他']=S.player.items['其他']||[];
  S.player.items['其他'].push({name:'万界通行证',desc:'公会发的'});
  return !!passItem()&&!abyssPass()&&crossCost('幽墟')===360;
}));

console.log('\n【求引荐】');
ok('神殿的按钮只在轮枢出现', await page.evaluate(()=>{ renderGate(); return !!document.getElementById('btnSeekPass'); }));
ok('求引荐要花钱，成了就落一张引荐状', await page.evaluate(()=>{
  S.player.attributes['悟性']=95; S.player['声望']=80;      // 判定必成，只看流程
  S.player.money=Math.max(num(S.player.money),2000);        // 香火钱按声望浮动，别让出身穷把这条卡掉
  const before=S.player.money;
  const r0=Math.random; Math.random=()=>0.99;               // 天命骰掷出 1 会大失败，钉死它
  seekAbyssPass(); Math.random=r0;
  return S.player.money<before && !!abyssPass() && S.ledger.some(x=>/求得引荐状/.test(x));
}));
ok('有了引荐状就不必翻倍', await page.evaluate(()=>crossCost('幽墟')===360));

ok('幽墟的规矩要点了它才说，不提前灌', await page.evaluate(()=>{
  openCross();
  const before=!!document.querySelector('.crossask');
  const el=Array.from(document.querySelectorAll('#crossList .crossopt')).find(x=>x.dataset.k==='幽墟');
  if(el) el.click();
  const ask=document.querySelector('.crossask');
  const t=ask?ask.textContent:'';
  $('crossMask').classList.remove('on');
  return before===false&&!!ask&&t.includes('每三个月磨你一次')&&t.includes('扔回轮枢')&&!!document.getElementById('askGo');
}));

console.log('\n【下去】');
await page.evaluate(()=>crossRealm('幽墟'));
await idle(); await page.waitForTimeout(500);
ok('人已在幽墟', await page.evaluate(()=>S.realm==='幽墟'));
ok('界徽换成☠', (await page.textContent('#jieSeal'))==='☠');
ok('进来那一趟花了多少记下了', await page.evaluate(()=>num(S.abyssPaid)>0&&S.abyssSince!=null&&S.abyssRolls===0));
ok('纪年换成无光，不记年', await page.evaluate(()=>/无光·第\d+月/.test(dateStr())&&!/年/.test(dateStr())));
ok('顶上那行日期立刻跟着换', /无光·第\d+月/.test(await page.textContent('#gameDate')));
ok('出身界仍是西陆，境界还按斗气那条路排', await page.evaluate(()=>
  S.homeRealm==='西陆'&&pathOf()==='斗气'&&/一阶|二阶|三阶|四阶|五阶|六阶/.test(tierOf(S.player.attributes['修为']))));
ok('界门卡把倒计时顶在最上面', await page.evaluate(()=>{
  S.gateOpen=false; renderGate();
  const t=$('wGate').textContent;
  return t.indexOf('门还有')>=0 && t.indexOf('门还有')<t.indexOf('当界');
}));

console.log('\n【境内的险】');
ok('天命骰每回合 −3', await page.evaluate(()=>{
  let mx=0; for(let i=0;i<200;i++) mx=Math.max(mx,fateRoll());
  return mx<=17&&mx>=15;
}));
ok('进来落在第一层外环，门槛 +5', await page.evaluate(()=>
  S.abyssLayer===1 && abyssDC()===5 && rollCheck('悟性',55).need===Math.max(20,55+diff().dc+5)));
ok('往下几层门槛跟着涨（+10/+10/+10/+12/+15）', await page.evaluate(()=>{
  const out=[]; for(let n=2;n<=6;n++){ S.abyssLayer=n; out.push(abyssDC()); } S.abyssLayer=1;
  return out.join()==='10,10,10,12,15';
}));
ok('判定尺子里写明了在第几层、加多少', await page.evaluate(()=>judgeBlock({fate:10,months:1}).includes('另加幽墟第1层的 +5')));
ok('随心所欲档在幽墟一样会受重伤', await page.evaluate(()=>{
  const f=S.fd_peril; fdSet('peril','free');
  const zero=fdm().injury===0;                 // 这一档本来免伤
  const n0=(S.scars||[]).length;
  for(let i=0;i<30;i++) sufferInjury(1,'试',true);
  const hurt=(S.scars||[]).length>n0;
  fdSet('peril',f); S.scars=S.scars.slice(0,n0);
  return zero&&hurt;
}));
ok('但仍然不会因为剧情死', await page.evaluate(()=>{
  const f=S.fd_peril; fdSet('peril','free'); const d=fdm().storyDeath; fdSet('peril',f); return d===0;
}));

console.log('\n【侵蚀度】');
ok('外环不掷侵蚀', await page.evaluate(()=>{
  S.abyssLayer=1; S.erosion=0; S.erosionClock=0; S.player.attributes['悟性']=1;
  for(let i=0;i<6;i++) erosionMonth();
  return S.erosion===0;
}));
ok('蚀骨荒原每两个月掷一次，失败 +1', await page.evaluate(()=>{
  S.abyssLayer=2; S.erosion=0; S.erosionClock=0;
  const r0=Math.random; Math.random=()=>0.3;
  erosionMonth(); const a=S.erosion; erosionMonth(); const b=S.erosion;
  Math.random=r0;
  return a===0&&b===1;
}));
ok('第三层起每三个月掷一次，失败 +2', await page.evaluate(()=>{
  S.abyssLayer=3; S.erosion=1; S.erosionClock=0;
  const r0=Math.random; Math.random=()=>0.3;
  erosionMonth(); erosionMonth(); const a=S.erosion; erosionMonth();
  Math.random=r0;
  return a===1&&S.erosion===3&&S.ledger.some(x=>/侵蚀度 1→3/.test(x));
}));
ok('跨进中度：添一条性情，练功打七折', await page.evaluate(()=>{
  const p0=(S.player.personality||[]).join();
  erosionAdd(1);
  return S.erosion===4&&(S.player.personality||[]).join()!==p0&&foreignPenalty().grow<foreignPenalty0().grow;
}));
ok('跨进重度：再添一条性情、落一条旧伤；三界里谈吐门槛 +10', await page.evaluate(()=>{
  const s0=(S.scars||[]).length; erosionAdd(3);
  const hurt=(S.scars||[]).length===s0+1;
  const r=S.realm; S.realm='东荒';
  const a=rollCheck('谈吐',55).need; S.erosion=0; const b=rollCheck('谈吐',55).need; S.erosion=7; S.realm=r;
  return S.erosion===7&&hurt&&a===b+10;
}));
ok('状态栏挂着侵蚀度', await page.evaluate(()=>{ rebuildStatus(); return S.player.status.includes('侵蚀度7'); }));
ok('提示词里有侵蚀度那一行（不叫「层」）', await page.evaluate(()=>{ const l=erosionLine(); return l.startsWith('【侵蚀度】7（重度）')&&!/7层/.test(l); }));
ok('随心所欲档封顶 9，不会堕化', await page.evaluate(()=>{
  const f=S.fd_peril; fdSet('peril','free'); erosionAdd(10); const a=S.erosion; fdSet('peril',f);
  return a===9&&!S.erosionFall;
}));
ok('另两档到 10 就堕化', await page.evaluate(()=>{
  erosionAdd(1); const a=S.erosion===10&&S.erosionFall===true; S.erosionFall=false; S.erosion=7; return a;
}));
ok('带着护心之物不掷', await page.evaluate(()=>{
  S.abyssLayer=2; S.erosionClock=1; const e=S.erosion;
  S.player.items['其他']=S.player.items['其他']||[]; S.player.items['其他'].push({name:'圣徒遗骨匣',ward:true});
  const r0=Math.random; Math.random=()=>0.3; erosionMonth(); Math.random=r0;
  const ok1=hasWard()&&S.erosion===e;
  S.player.items['其他']=S.player.items['其他'].filter(x=>!x.ward);
  return ok1;
}));
ok('上去以后：中度以下每六个月退 1，重度不退', await page.evaluate(()=>{
  const r=S.realm; S.realm='轮枢';
  S.erosion=5; S.erosionCalm=0; for(let i=0;i<12;i++) erosionMonth(); const a=S.erosion;
  S.erosion=8; for(let i=0;i<12;i++) erosionMonth(); const b=S.erosion;
  S.realm=r; S.erosion=0;
  return a===3&&b===8;
}));

console.log('\n【六层】');
ok('往下要过一次修为判定，过了就到下一层', await page.evaluate(async()=>{
  S.abyssLayer=1; S.player.attributes['修为']=200; S.abyssDue=nextGateAfter(S.months+96); S.erosion=0;
  S.player.items['其他'].push({name:'试用护符',ward:true});
  const r0=Math.random; Math.random=()=>0.9;
  abyssMove(1); Math.random=r0;
  return S.abyssLayer===2&&S.ledger.some(x=>/下到幽墟第2层·蚀骨荒原/.test(x));
}));
await idle();
ok('卡上写着第几层、有上下两个按钮', await page.evaluate(()=>{
  renderGate(); const t=$('wGate').textContent;
  return t.includes('第 2 层·蚀骨荒原')&&!!$('btnUp')&&!!$('btnDown');
}));
ok('提示词写了本层和本层头目', await page.evaluate(()=>{
  const b=bossBlock(); return b.includes('【幽墟·第2层】蚀骨荒原')&&b.includes('别西卜｜蝇王')&&!b.includes('波旬');
}));
ok('不在第一层出不去', await page.evaluate(()=>{
  S.gateOpen=true; const t=crossTargets()[0]; S.gateOpen=false;
  return t.ok===false&&t.why.includes('第一层');
}));
ok('第五层下不去，要先过吞噬者', await page.evaluate(()=>{
  S.abyssLayer=5; S.coreOpen=false; renderGate();
  const has=!!$('btnDevour')&&!$('btnDown');
  abyssMove(1);
  return has&&S.abyssLayer===5;
}));
ok('胜过吞噬者门就开了；到了墟心记一笔', await page.evaluate(async()=>{
  S.coreOpen=true; S.player.attributes['修为']=200;
  const r0=Math.random; Math.random=()=>0.9; abyssMove(1); Math.random=r0;
  return S.abyssLayer===6&&S.reachedCore===true&&S.ledger.some(x=>/抵达墟心/.test(x));
}));
await idle();
ok('横幅跟着层走', await page.evaluate(()=>{
  const out=[]; for(let n=1;n<=6;n++){ S.abyssLayer=n; out.push(sceneKey()); }
  return out.join()==='sc_a_rim,sc_a_waste,sc_a_fire,sc_a_street,sc_a_abyss,sc_a_core';
}));
ok('往上不判定', await page.evaluate(()=>{ abyssMove(-1); return S.abyssLayer===5; }));
await idle();
await page.evaluate(()=>{ S.abyssLayer=1; S.abyssSince=S.months; S.player.items['其他']=S.player.items['其他'].filter(x=>x.name!=='试用护符'); });
ok('一路上没被丢出去', await page.evaluate(()=>S.realm==='幽墟'));

console.log('\n【幽墟器物】');
ok('幽墟得来的东西一律打上印记', await page.evaluate(()=>{
  applyTurn({narrative:'x',summary:'x',playerChanges:{itemsAdd:{'法宝':[{name:'骨刀',desc:'凉的',bonus:28}]}}},'试',{fate:10,months:0});
  const it=(S.player.items['法宝']||[]).find(x=>x.name==='骨刀');
  return !!it&&it.cursed===true&&it.from==='幽墟'&&(it.curse==='hp'||it.curse==='evil');
}));
ok('加成高出一档（封顶 30，寻常物仍是 20）', await page.evaluate(()=>{
  const a=weaponBonus(S.player);
  const it=(S.player.items['法宝']||[]).find(x=>x.name==='骨刀'); it.cursed=false;
  const b=weaponBonus(S.player); it.cursed=true;
  return a===28&&b===20;
}));
ok('每月要账：不扣气血就涨恶名', await page.evaluate(()=>{
  const it=(S.player.items['法宝']||[]).find(x=>x.name==='骨刀');
  it.curse='hp'; S.player.hp=100; cursedTick(1);
  const hp=S.player.hp===97;
  it.curse='evil'; const e0=num(S.player['恶名']); cursedTick(1);
  return hp && num(S.player['恶名'])===e0+2;
}));
ok('丢了就停', await page.evaluate(()=>{
  S.player.items['法宝']=(S.player.items['法宝']||[]).filter(x=>x.name!=='骨刀');
  S.player.hp=100; cursedTick(3);
  return S.player.hp===100;
}));

console.log('\n【名录只给半套】');
let jb=await page.evaluate(()=>jieBlock());
ok('三支魔族与堕落者都在，六层写全', jb.includes('噬渊')&&jb.includes('蚀骨')&&jb.includes('幻面')&&jb.includes('堕落者')&&!jb.includes('枯骨庭')&&['幽墟外环','蚀骨荒原','业火熔渊','百鬼夜行街','无光海','墟心'].every(x=>jb.includes(x)));
ok('没有自己的修行体系', jb.includes('幽墟没有自己的修行体系')&&!jb.includes('本界的境界由低到高'));
ok('写明主角修的仍是西陆那一套', jb.includes('他是西陆人')||jb.includes('西陆来的异界人'));
ok('写明这儿问得到别处问不到的事', jb.includes('别处问不到的事')&&jb.includes('rumors'));
ok('地名表挂上了横幅', await page.evaluate(()=>{
  return placeScene('无光海')==='sc_a_abyss'&&placeScene('百鬼夜行街')==='sc_a_street'&&placeScene('幽墟外环')==='sc_a_rim'&&placeScene('墟心')==='sc_a_core'&&!placeScene('枯骨庭');
}));

ok('幽墟不入万界榜', await page.evaluate(()=>
  !(S.world.ranking||[]).some(r=>r.realm==='幽墟')&&(S.world.factions||[]).some(f=>f.realm==='幽墟')));

console.log('\n【跨界宿命】');
ok('人不在幽墟时结不了案', await page.evaluate(()=>{
  const r=S.realm; S.realm='轮枢';
  const q=S.quests.find(x=>x.kind==='abyss'); q.status='进行中'; q.progress=50;
  applyTurn({narrative:'x',summary:'x',questUpdates:[{title:q.title,status:'完成'}]},'试',{fate:10,months:0});
  const blocked=q.status==='进行中'&&q.progress<=95;
  S.realm=r;
  return blocked;
}));
ok('在幽墟才了结得了，了结之后异界适应归零', await page.evaluate(()=>{
  const q=S.quests.find(x=>x.kind==='abyss');
  applyTurn({narrative:'x',summary:'x',questUpdates:[{title:q.title,status:'完成'}]},'试',{fate:10,months:0});
  const f=foreignPenalty();
  return q.status==='完成'&&S.abyssFreed===true&&f.grow===1&&f.cost===1;
}));

console.log('\n【上来】');
ok('幽墟只有轮枢那一道门', await page.evaluate(()=>{
  const l=crossTargets();
  return l.length===1&&l[0].key==='轮枢';
}));
ok('门关着上不去，没有走私客那条路了', await page.evaluate(()=>{
  S.gateOpen=false;
  const t=crossTargets()[0];
  return t.ok===false&&/才开/.test(t.why);
}));
ok('赶上开门就不花钱走人', await page.evaluate(()=>{
  S.gateOpen=true;
  return crossCost('轮枢')===0&&crossTargets()[0].ok===true;
}));
ok('下来时就记了期限：下一个开门月', await page.evaluate(()=>S.abyssDue!=null&&isGateMonth(S.abyssDue)));

console.log('\n【正文没漏别界的词】');
await page.evaluate(()=>{ S.gateOpen=false; });
await page.click('#choices .opt'); await idle();
const bd=await body();
const lk=LEAK_ABYSS.filter(w=>bd.includes(w));
ok('幽墟正文无跨界泄漏'+(lk.length?'（'+lk.join('、')+'）':''), lk.length===0);

await page.evaluate(()=>{ S.gateOpen=true; S.gateCloseAt=S.months+2; });
await page.evaluate(()=>crossRealm('轮枢'));
await idle(); await page.waitForTimeout(400);
ok('上来之后侵蚀停了，账也记了', await page.evaluate(()=>
  S.realm==='轮枢'&&S.abyssSince==null&&S.abyssRolls===0&&S.ledger.some(x=>/从幽墟上来了/.test(x))));
ok('落下的旧伤与性情不还', await page.evaluate(()=>(S.scars||[]).length>0||(S.player.personality||[]).length>0));

console.log('\n【老存档】');
ok('v9 升到 v10，补上幽墟那几个字段', await page.evaluate(()=>{
  const s={v:9,realm:'西陆',homeRealm:'西陆',realmSince:0,months:30,npcs:[],foreignFrom:null,
    player:{arts:[],items:{'法宝':[{name:'旧刀',from:'西陆'}]}}};
  migrate(s);
  return s.v>=10&&s.abyssSince===null&&s.abyssRolls===0&&s.abyssFreed===false
      && s.player.items['法宝'][0].cursed===false;
}));

console.log('\n【手机 390×844】');
await page.setViewportSize({width:390,height:844});
await page.waitForTimeout(300);
ok('无横向溢出', !(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1)));
await page.setViewportSize({width:1400,height:900}); await page.waitForTimeout(200);
await page.evaluate(()=>{ S.realm='幽墟'; S.abyssSince=num(S.months); applyRealmTheme(); renderPanel(); renderWorld(); renderScene(); });
await page.waitForTimeout(300);
await page.screenshot({path:path.join(__dirname,'s5-abyss.png')});

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
ok('全程无页面报错', errs.length===0);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
