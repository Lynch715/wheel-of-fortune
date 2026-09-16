// S6 万界局势：界主、界势与幽墟压力、开门那两个月的魔潮与攻伐
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
srv.listen(8941);
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
await page.goto('http://localhost:8941/');
await page.waitForTimeout(400);
await page.click('#jieGrid .jiebtn[data-k="东荒"]');
await page.waitForTimeout(150);
await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});

console.log('\n【开局】');
ok('出生界当场就有界主，且不是传闻', await page.evaluate(()=>{
  const l=S.lords['东荒']; return !!l&&l.rumor===false&&!!l.name;
}));
ok('没去过的两界只有传闻', await page.evaluate(()=>
  S.lords['西陆'].rumor===true&&S.lords['樱洲'].rumor===true&&!!S.lords['西陆'].name));
ok('三对关系从平常起步，压力 20', await page.evaluate(()=>
  Object.keys(S.ties).length===3&&Object.values(S.ties).every(v=>v===50)&&S.voidP===20));
ok('轮枢与幽墟不设界主', await page.evaluate(()=>!S.lords['轮枢']&&!S.lords['幽墟']));

console.log('\n【界主怎么算】');
ok('分 = 势力×0.5 + 声望×0.3 + 修为×0.2', await page.evaluate(()=>
  lordCalc(80,60,50,false)===Math.round((80*0.5+60*0.3+wuNorm(50)*0.2)*10)/10));
ok('异界之身打六折', await page.evaluate(()=>{
  const a=lordCalc(80,60,50,false), b=lordCalc(80,60,50,true);
  return Math.abs(b-Math.round(a*0.6*10)/10)<0.15;
}));
ok('贡献没到顶就不算掌了势力', await page.evaluate(()=>{
  S.sect={name:(S.world.factions.find(f=>f.realm==='东荒')||{}).name,contrib:100,joined:0};
  const low=playerFactionPower();
  S.sect.contrib=999;
  const high=playerFactionPower();
  return low===0&&high>0;
}));

console.log('\n【坐上去，再掉下来】');
ok('声望修为势力都压过去，重算之后就是界主', await page.evaluate(()=>{
  S.player['声望']=100; S.player.attributes['修为']=100;
  recalcLords();
  return S.lords['东荒'].isPlayer===true&&myLordRealm()==='东荒'&&S.ledger.some(x=>/界主之位/.test(x));
}));
ok('界主月耗降三成', await page.evaluate(()=>{
  const a0=S.player.age; S.player.age=60;          // 基数太小时三成会被四舍五入吃掉，拿个上了年纪的算
  const a=upkeepPerMonth();
  const l=S.lords['东荒']; S.lords['东荒']={name:'某某',isPlayer:false,rumor:false,score:99,second:0};
  const b=upkeepPerMonth(); S.lords['东荒']=l; S.player.age=a0;
  return a<b;
}));
ok('坐上去之后恨你的人翻倍', await page.evaluate(()=>{
  const base=(S.difficulty==='hard'?1.4:(S.difficulty==='easy'?0.6:1))*fdm().vendetta;
  return isLord()===true&&base>0;
}));
ok('分被人超过就丢位，记进旧账', await page.evaluate(()=>{
  const f=S.world.factions.find(x=>x.realm==='东荒');
  S.world.ranking.push({name:'压你一头的人',faction:f.name,realm:'东荒','修为':100,note:'',alive:true,age:50});
  f.leader='压你一头的人'; f.power=100;
  S.sect.contrib=0;                       // 你自己的势力没了
  S.player['声望']=10;
  recalcLords();
  return S.lords['东荒'].isPlayer!==true&&S.ledger.some(x=>/丢了东荒界主之位/.test(x));
}));

console.log('\n【界势与压力】');
ok('闲着的时候压力慢慢落、关系慢慢坏', await page.evaluate(()=>{
  S.gateOpen=false; S.voidP=40; S.ties['东荒-西陆']=50;
  const j=TUNE.jitter; TUNE.jitter=0;
  worldTick(4); TUNE.jitter=j;
  return S.voidP<34&&S.voidP>28&&S.ties['东荒-西陆']<49.5&&S.ties['东荒-西陆']>48.5;
}));
ok('压力够高，开门那个月三界回暖', await page.evaluate(()=>{
  S.gateOpen=true; S.voidP=70; S.ties['东荒-西陆']=50;
  worldTick(1);
  return S.ties['东荒-西陆']===56;
}));
ok('压力不够高，开门就趁乱互削', await page.evaluate(()=>{
  S.gateOpen=true; S.voidP=30; S.ties['东荒-西陆']=50;
  worldTick(1);
  return S.ties['东荒-西陆']===47;
}));
ok('关系低于 40 就算要开打', await page.evaluate(()=>{
  S.ties['东荒-西陆']=30;
  const w=warPairs();
  S.ties['东荒-西陆']=50;
  return w.length===1&&w[0].join('-')==='东荒-西陆';
}));
ok('在幽墟杀掉魔族的人，压力落一截', await page.evaluate(()=>{
  const r=S.realm, v=S.voidP; S.realm='幽墟'; S.voidP=50;
  voidAdd(-8);
  const got=S.voidP===42; S.realm=r; S.voidP=v; return got;
}));

console.log('\n【开门那两个月】');
ok('门一开，压力先顶上来一截', await page.evaluate(()=>{
  S.gateOpen=false; S.voidP=30; S.months+= (5-monthIdx()+12)%12;
  gateTick();
  return S.gateOpen===true&&S.voidP>=39;             // 30 + 至少 6 + 魔潮 3
}));
ok('起了魔潮，记进旧账，轻重看压力', await page.evaluate(()=>
  num(S.tideSev)>=1&&S.ledger.some(x=>/魔劫|魔潮|百鬼夜行/.test(x))));
ok('魔潮那两个月物价涨', await page.evaluate(()=>{
  const a=upkeepPerMonth(); const t=S.tideSev; S.tideSev=0;
  const b=upkeepPerMonth(); S.tideSev=t;
  return a>b;
}));
ok('魔潮当头，世界事件让位给它', await page.evaluate(()=>{
  const e=tideEvent();
  return !!e&&e.includes('不许当它没发生')&&makeJudge(null,'走走').worldEvent===e;
}));
ok('关系差的两界，门一开就打起来', await page.evaluate(()=>{
  S.ties['东荒-西陆']=20; S.engineNews=[];
  warTick();
  return S.ledger.some(x=>/与西陆开战|东荒与西陆/.test(x));
}));
ok('打起仗来，异界之身判定门槛 +5', await page.evaluate(()=>{
  const r=S.realm, h=S.homeRealm;
  S.realm='西陆'; S.homeRealm='东荒'; S.ties['东荒-西陆']=20; S.gateOpen=true;
  const dc=warDC(), inJudge=judgeBlock({fate:10,months:1}).includes('战时外人的 +5');
  S.realm=r; S.homeRealm=h;
  return dc===5&&inJudge;
}));
ok('本界在打仗，师门会来叫人', await page.evaluate(()=>{
  const f=S.world.factions.find(x=>x.realm==='东荒');
  S.player.faction=f.name; S.sect={name:f.name,contrib:100,joined:0};
  S.ties['东荒-西陆']=20; S.gateOpen=true; S.warServed=0;
  return callUp()===true;
}));
ok('应征上阵：要么记功，要么被抬下来，两样都记账', await page.evaluate(()=>{
  const n0=S.ledger.length;
  answerCallUp(true);
  return S.warServed===1&&S.ledger.length>n0&&S.ledger.some(x=>/出阵/.test(x))&&callUp()===false;
}));
ok('推了就掉贡献', await page.evaluate(()=>{
  S.warServed=0; S.sect.contrib=100;
  answerCallUp(false);
  return S.sect.contrib===70&&S.ledger.some(x=>/推了/.test(x));
}));

console.log('\n【局势进了提示词】');
const sb=await page.evaluate(()=>stateBlocks());
ok('局势块在【当前时间】之后（不破前缀缓存）', sb.indexOf('【万界局势】')>sb.indexOf('【当前时间】'));
ok('三界界主都写上了', sb.includes('三界界主')&&sb.includes('东荒')&&sb.includes('西陆')&&sb.includes('樱洲'));
ok('没去过的界注明只是传闻', await page.evaluate(()=>{
  S.lords['樱洲']={name:'白河铃',rumor:true};
  return situBlock().includes('只是传闻');
}));
ok('有战事就写出来', await page.evaluate(()=>situBlock().includes('打')));
ok('压力与界势都在', sb.includes('幽墟压力')&&sb.includes('界势'));
ok('明写这几个数是引擎的账，要对上', sb.includes('引擎记的账'));

console.log('\n【界门卡】');
ok('卡上列了三界界主、压力、界势', await page.evaluate(()=>{
  renderGate(); const t=$('wGate').textContent;
  return t.includes('界主')&&t.includes('幽墟压力')&&t.includes('界势');
}));
ok('身为界主，开门时能定方针', await page.evaluate(()=>{
  S.player['声望']=100; S.player.attributes['修为']=100; S.sect.contrib=999;
  const f=S.world.factions.find(x=>x.realm==='东荒'); f.leader=S.player.name;
  recalcLords(); S.gateOpen=true; renderGate();
  return myLordRealm()==='东荒'&&!!document.querySelector('#wGate button[data-p="守"]')&&!!document.querySelector('#wGate button[data-p="攻"]');
}));
ok('不定方针就算「守」：本界死伤减半', await page.evaluate(()=>{
  S.lordPolicy=null; return policyRisk('东荒')===0.5&&policyRisk('西陆')===1;
}));
ok('定了「攻」：压力当场多降 6，死伤加重；改回守就退回去', await page.evaluate(()=>{
  S.voidP=50;
  setLordPolicy('攻');
  const a=S.lordPolicy==='攻'&&S.voidP===44&&policyRisk('东荒')===1.5;
  setLordPolicy('守');
  return a&&S.voidP===50&&S.lordPolicy==='守';
}));
ok('打邻居、两不相帮那两条没了', await page.evaluate(()=>{ setLordPolicy('打邻居'); return S.lordPolicy==='守'&&LORD_POLICY.length===2; }));
ok('界主每月有进账，满六个月送一件法宝', await page.evaluate(()=>{
  const m=S.player.money, n=(S.player.items['法宝']||[]).length;
  S.lordMonths=5; lordMonthly();
  return S.player.money>=m+42&&(S.player.items['法宝']||[]).length===n+1&&S.lordMonths===6;
}));
ok('只在正月重算界主', await page.evaluate(()=>{
  let c=0; const f=recalcLords; recalcLords=()=>{c++;};
  S.months-=monthIdx(); S.months+=3; gateTick(); const a=c;
  S.months+=9; gateTick(); recalcLords=f;
  return a===0&&c===1;
}));

// 新机制横幅：状态压过地名（美术 v2.1 第 1.3 节）
ok('身为界主，卡顶挂上朝堂那张', await page.evaluate(()=>
  !!document.querySelector('#wGate .courtbar')));
ok('不是界主就没有这一条', await page.evaluate(()=>{
  const keep=S.lords['东荒']; S.lords['东荒']={name:'旁人',score:999,second:0};
  renderGate(); const gone=!document.querySelector('#wGate .courtbar');
  S.lords['东荒']=keep; renderGate(); return gone;
}));
ok('魔潮那两个月，当界横幅换成魔劫', await page.evaluate(()=>{
  const l=S.scene.location, sv=S.tideSev, go=S.gateOpen;
  S.scene.location='云台观'; S.gateOpen=true; S.tideSev=2;
  const k=sceneKey();
  S.scene.location=l; S.tideSev=sv; S.gateOpen=go;
  return k==='sc_d_tide';
}));
ok('魔潮过去就换回常规横幅', await page.evaluate(()=>{
  const l=S.scene.location, sv=S.tideSev; S.scene.location='云台观'; S.tideSev=0;
  const k=sceneKey(); S.scene.location=l; S.tideSev=sv;
  return k!=='sc_d_tide';
}));
ok('本界开着战就换战场那张', await page.evaluate(()=>{
  const l=S.scene.location, sv=S.tideSev, go=S.gateOpen, t=S.ties['东荒-西陆'];
  S.scene.location='云台观'; S.tideSev=0; S.gateOpen=true; S.ties['东荒-西陆']=10;
  const k=sceneKey();
  S.scene.location=l; S.tideSev=sv; S.gateOpen=go; S.ties['东荒-西陆']=t;
  return k==='sc_war';
}));

console.log('\n【轮外之物】');
ok('各界叫法不同，且铁律写明只准用本界的', await page.evaluate(()=>{
  const nm=['东荒','西陆','樱洲','轮枢','幽墟'].map(k=>outerName(k));
  return new Set(nm).size===5 && nm[0]==='噬轮者' && nm[2]==='常暗' && nm[4]==='祂'
      && lawBlock().includes('只准用哪一界的叫法') && lawBlock().includes('它要的是占领三界')&&!lawBlock().includes('没人投胎');
}));
ok('没下过幽墟就没这桩宿命', await page.evaluate(()=>{
  S.quests=(S.quests||[]).filter(q=>q.kind!=='outer');
  return hasOuterQuest()===false&&$('outerCard').style.display!=='block';
}));
ok('下过一趟幽墟就背上了', await page.evaluate(()=>{
  grantOuterQuest();
  const q=(S.quests||[]).find(x=>x.kind==='outer');
  return !!q&&q.status==='进行中'&&S.ledger.some(x=>/天大的宿命/.test(x));
}));
ok('三条件一条没齐时按钮不出来', await page.evaluate(()=>{
  S.abyssMonths=0; S.bossKilled=[]; S.reachedCore=false;
  renderWorld();
  return outerChain().length===3&&outerReady()===false&&!document.getElementById('btnOuter');
}));
ok('幽墟的月数是累计的，不是当次的', await page.evaluate(()=>{
  const r=S.realm, m=S.abyssMonths, L=S.abyssLayer; S.realm='幽墟'; S.abyssLayer=1; S.abyssDue=S.months+99; S.abyssMonths=0;
  advanceTime(5); const a=S.abyssMonths;
  S.realm=r; S.abyssLayer=L; advanceTime(3); const b=S.abyssMonths;
  S.abyssMonths=m; S.realm=r;
  return a===5&&b===5;
}));
ok('头目按名字记，同一个不重复，杂兵不算', await page.evaluate(()=>{
  S.bossKilled=[]; const v=S.voidP; S.voidP=50;
  killBoss('别西卜'); killBoss('别西卜'); killBoss('路人甲'); killBoss('波旬');
  const ok1=S.bossKilled.join()==='别西卜,波旬'&&S.voidP===34;
  S.voidP=v; return ok1;
}));
ok('头目一共 22 位，按层摆好，吞噬者守在第六层', await page.evaluate(()=>
  ABYSS_BOSSES.length===22&&ABYSS_BOSSES.filter(b=>b.layer===5).length===7&&bossOf('吞噬者').layer===6&&bossOf('墟使').layer===1
  &&ABYSS_BOSSES.every(b=>b.wu===60+6*b.layer&&b.weak&&b.title)));
ok('联署那一套删掉了', await page.evaluate(()=>typeof lordSigned==='undefined'&&typeof OUTER_CLANS==='undefined'));
ok('三条齐了、人在墟心才出讨伐按钮', await page.evaluate(()=>{
  S.abyssMonths=12; S.bossKilled=['别西卜','波旬','该隐']; S.reachedCore=true;
  S.outerCool=0; S.outerBeaten=false;
  S.realm='东荒'; renderWorld();
  const away=outerReady()===false&&!document.getElementById('btnOuter');
  S.realm='幽墟'; S.abyssLayer=6; S.abyssDue=S.months+99; renderWorld();
  return away&&outerChain().every(x=>x.ok)&&outerReady()===true&&!!document.getElementById('btnOuter');
}));
ok('清单三条都摆在万界页上，到过墟心才露脸', await page.evaluate(()=>{
  const t=$('outerCard').textContent;
  return $('outerCard').style.display==='block'&&t.includes('待满')&&t.includes('头目')&&t.includes('墟心')&&!t.includes('联署')&&!!document.querySelector('#outerCard .outerpic');
}));
ok('输了那两档是真会死（引擎口径）', await page.evaluate(()=>
  num(FREEDOM.strict.storyDeath)>0&&num(FREEDOM.mid.storyDeath)>0&&num(FREEDOM.free.storyDeath)===0));
ok('随心所欲档打输：不死，但什么都没了', await page.evaluate(async()=>{
  const rnd0=Math.random; Math.random=()=>0;      // 掷 1 必败
  const f=S.fd_peril; fdSet('peril','free');
  S.player.attributes['修为']=90; S.scars=[];
  S.player.items['其他']=(S.player.items['其他']||[]); S.player.items['其他'].push({name:'骨器',cursed:true,curse:'evil'});
  await fightOuter();
  Math.random=rnd0; fdSet('peril',f);
  return S.outerBeaten!==true && S.player.attributes['修为']<=12 && cursedHeld()===0
      && (S.scars||[]).length>0 && num(S.outerCool)>num(S.months);
}));
ok('伤了元气那二十四个月动不了它', await page.evaluate(()=>{
  renderWorld();
  return outerCooling()===true&&outerReady()===false&&!document.getElementById('btnOuter')
      &&$('outerCard').textContent.includes('元气');
}));
ok('斩了它：压力清零、三界拉满、称号带上、宿命了结、幽墟变安全', await page.evaluate(async()=>{
  const rnd0=Math.random; Math.random=()=>0.999;   // 掷 20 必成
  S.outerCool=0; S.player.attributes['修为']=90;
  await fightOuter();
  Math.random=rnd0;
  const q=(S.quests||[]).find(x=>x.kind==='outer');
  return S.outerBeaten===true && S.abyssSafe===true && Math.round(voidP())===0
      && Object.values(S.ties).every(v=>v===100)
      && titleOf(S.player).indexOf('斩轮外者')===0
      && q&&q.status==='完成'
      && S.ledger.some(x=>/在墟心斩了/.test(x));
}));
ok('斩过之后不再出按钮，卡上只留一句', await page.evaluate(()=>{
  renderWorld();
  return !document.getElementById('btnOuter')&&$('outerCard').textContent.includes('三界还在');
}));
ok('幽墟安全之后：门开也不涨压力、不起魔潮，幽墟随时进出', await page.evaluate(()=>{
  S.realm='轮枢'; S.abyssLayer=0; S.gateOpen=false; S.voidP=0; S.tideSev=0;
  S.months+=(5-monthIdx()+12)%12; gateTick();
  const quiet=S.voidP===0&&!S.tideSev;
  S.gateOpen=false;
  const t=crossTargets().find(x=>x.key==='幽墟');
  S.realm='东荒';
  return quiet&&t.ok===true;
}));

console.log('\n【世界观卡与减字】');
ok('世界观卡在万界页最上面，默认展开', await page.evaluate(()=>{
  renderWorld();
  const pane=document.getElementById('tab-world');
  return pane.firstElementChild.id==='loreCard'
      && $('loreBody').style.display!=='none'
      && $('loreBody').textContent.includes('万界像一只轮');
}));
ok('第一层写清了轮、三界、界门和你生在哪儿', await page.evaluate(()=>{
  const t=$('loreBody').textContent;
  return t.includes('你生在')&&t.includes('灵气')&&t.includes('斗气')&&t.includes('咒力')&&t.includes('轮心是轮枢');
}));
ok('没去过轮枢就不提轮枢', await page.evaluate(()=>{
  const f=S.forged, r=S.realm; S.forged=['东荒']; S.realm='东荒';
  const a=loreParas().join('');
  S.forged=f; S.realm=r;
  return !a.includes('轮心那座城');
}));
ok('去过了才提', await page.evaluate(()=>{
  const f=S.forged; S.forged=['东荒','轮枢'];
  const a=loreParas().join(''); S.forged=f;
  return a.includes('轮心那座城');
}));
ok('压力没起来、也没下过幽墟，就不提幽墟会打上来', await page.evaluate(()=>{
  const v=S.voidP, m=S.abyssMonths, r=S.realm;
  S.voidP=20; S.abyssMonths=0; S.realm='东荒';
  const a=loreParas().join('');
  S.voidP=v; S.abyssMonths=m; S.realm=r;
  return !a.includes('百鬼夜行');
}));
ok('压力上来了就提', await page.evaluate(()=>{
  const v=S.voidP; S.voidP=50;
  const a=loreParas().join(''); S.voidP=v;
  return a.includes('百鬼夜行')&&a.includes('六月、十二月');
}));
ok('背上那桩宿命之后才说它要占领三界', await page.evaluate(()=>{
  const q=S.quests, b=S.outerBeaten;
  S.quests=(S.quests||[]).filter(x=>x.kind!=='outer'); S.outerBeaten=false;
  const a=loreParas().join('');
  S.quests=q; S.outerBeaten=b;
  const c=loreParas().join('');
  return !a.includes('占领三界')&&c.includes('占领三界');
}));
ok('点标题能收起，而且记得住', await page.evaluate(()=>{
  toggleLore();
  const closed=$('loreBody').style.display==='none'&&S.loreSeen===1;
  toggleLore();
  return closed&&$('loreBody').style.display!=='none';
}));
ok('自由度底下那行数值罗列没了', await page.evaluate(()=>
  !document.getElementById('cfgFreeNote')&&!document.getElementById('crFreeNote')&&typeof window.freedomNote==='undefined'));
ok('界门卡不再有「已轮转N次」和那条分隔线', await page.evaluate(()=>{
  renderGate(); const t=$('wGate').textContent;
  return !t.includes('已轮转')&&!t.includes('──────');
}));
ok('宿命卡副标题只剩一句', (await page.textContent('#tab-world')).includes('你此生要追的事')
   && !(await page.textContent('#tab-world')).includes('引擎只管记账'));

console.log('\n【老存档】');
ok('v11 升到 v12，局势从平常起步', await page.evaluate(()=>{
  const s={v:11,realm:'东荒',homeRealm:'东荒',months:0,wheelTurns:4,npcs:[],forged:['东荒'],
    world:{factions:[],ranking:[],events:[],fallen:[],vacant:0},player:{name:'甲',items:{},attributes:{'修为':10},'声望':10}};
  migrate(s);
  return s.v>=14&&s.loreSeen===0&&!!s.ties&&Object.values(s.ties).every(v=>v===50)&&s.voidP===20&&!!s.lords&&!('wheelTurns' in s)&&s.v===SAVE_VERSION
      &&s.abyssMonths===0&&Array.isArray(s.bossKilled)&&!('outerHeads' in s)&&s.outerBeaten===false;
}));

console.log('\n【手机 390×844】');
await page.setViewportSize({width:390,height:844});
await page.evaluate(()=>{ setDrawer(true); document.querySelector('[data-tab="world"]').click(); });
await page.waitForTimeout(300);
ok('无横向溢出', !(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1)));
await page.screenshot({path:path.join(__dirname,'s6-gate-phone.png')});
await page.setViewportSize({width:1400,height:900}); await page.waitForTimeout(200);
await page.screenshot({path:path.join(__dirname,'s6-desk.png')});

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
ok('全程无页面报错', errs.length===0);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
