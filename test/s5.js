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
ok('可停的辐还是三个，幽墟不在其中', await page.evaluate(()=>
  Array.from(document.querySelectorAll('#wheelSvg .spoke:not(.locked)')).every(e=>e.dataset.k!=='幽墟')
  && document.querySelectorAll('#wheelSvg .spoke:not(.locked)').length===3));
ok('图例仍标着不可投胎', (await page.textContent('#wheelLegend')).includes('不可投胎'));

await page.click('#wheelSvg .spoke[data-k="西陆"]');
await page.waitForTimeout(200);
await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});

console.log('\n【下不去的时候】');
ok('人在西陆：幽墟根本不在过界清单里出现可去的样子', await page.evaluate(()=>{
  S.gateOpen=true;
  const t=crossTargets().find(x=>x.key==='幽墟');
  return !!t && t.ok===false && t.why.includes('得先到轮枢');
}));
ok('过界弹窗里写明了幽墟怎么下去怎么上来', await page.evaluate(()=>{
  openCross(); const t=document.querySelector('.gaterule').textContent; $('crossMask').classList.remove('on');
  return t.includes('引荐状')&&t.includes('下来那一趟的两倍')&&t.includes('幽墟不可投胎');
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
  return !!t&&t.ok===false&&t.why.includes('轮转开门那两个月');
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
  const before=S.player.money;
  seekAbyssPass();
  return S.player.money<before && !!abyssPass() && S.ledger.some(x=>/求得引荐状/.test(x));
}));
ok('有了引荐状就不必翻倍', await page.evaluate(()=>crossCost('幽墟')===360));

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
  return t.indexOf('离下一次界门松动还有')>=0 && t.indexOf('离下一次界门松动还有')<t.indexOf('当界');
}));

console.log('\n【境内的险】');
ok('天命骰每回合 −3', await page.evaluate(()=>{
  let mx=0; for(let i=0;i<200;i++) mx=Math.max(mx,fateRoll());
  return mx<=17&&mx>=15;
}));
ok('所有门槛 +10', await page.evaluate(()=>
  abyssDC()===10 && rollCheck('悟性',55).need===Math.max(20,55+diff().dc+10)));
ok('判定尺子里写明了幽墟这 +10', await page.evaluate(()=>judgeBlock({fate:10,months:1}).includes('另加幽墟的 +10')));
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

console.log('\n【侵蚀】');
ok('每连着待满三个月掷一次，越待越难', await page.evaluate(()=>{
  S.player.attributes['悟性']=1;                 // 必败，看后果
  S.abyssSince=S.months-9; S.abyssRolls=0;
  const s0=(S.scars||[]).length, p0=(S.player.personality||[]).slice();
  abyssTick();
  const changed=((S.scars||[]).length>s0) || (S.player.personality||[]).join()!==p0.join();
  return S.abyssRolls===3 && changed && S.ledger.concat(S.engineNews||[]).some(x=>/侵蚀|啃下一块/.test(x));
}));
ok('待够之前不掷', await page.evaluate(()=>{
  S.abyssSince=S.months-2; S.abyssRolls=0; abyssTick();
  return S.abyssRolls===0;
}));

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
ok('五支势力都在', jb.includes('噬渊族')&&jb.includes('蚀骨族')&&jb.includes('幻面族')&&jb.includes('枯骨庭')&&jb.includes('堕落者'));
ok('没有自己的修行体系', jb.includes('幽墟没有自己的修行体系')&&!jb.includes('本界的境界由低到高'));
ok('写明主角修的仍是西陆那一套', jb.includes('他是西陆人')||jb.includes('西陆来的异界人'));
ok('写明这儿问得到别处问不到的事', jb.includes('别处问不到的事')&&jb.includes('rumors'));
ok('地名表挂上了横幅', await page.evaluate(()=>{
  const l=S.scene.location; S.scene.location='无光渊'; const k=sceneKey();
  S.scene.location='枯骨庭'; const k2=sceneKey(); S.scene.location=l;
  return k==='sc_a_abyss'&&k2==='sc_a_waste';
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
ok('门关着就雇走私客，价钱是下来那趟的两倍', await page.evaluate(()=>{
  S.gateOpen=false;
  return crossCost('轮枢')===num(S.abyssPaid)*2;
}));
ok('赶上开门就照常价走人', await page.evaluate(()=>{
  S.gateOpen=true; S.gateCloseAt=S.months+2;
  return crossCost('轮枢')===120;
}));

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
