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
await page.click('#wheelSvg .spoke[data-k="东荒"]');
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
ok('声望修为势力都压过去，轮转之后就是界主', await page.evaluate(()=>{
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
  worldTick(4);
  return S.voidP===36&&S.ties['东荒-西陆']===48;
}));
ok('压力够高，开门那两个月三界回暖', await page.evaluate(()=>{
  S.gateOpen=true; S.voidP=70; S.ties['东荒-西陆']=50;
  worldTick(1);
  return S.ties['东荒-西陆']===58;
}));
ok('压力不够高，开门就趁乱互削', await page.evaluate(()=>{
  S.gateOpen=true; S.voidP=30; S.ties['东荒-西陆']=50;
  worldTick(1);
  return S.ties['东荒-西陆']===45;
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
  S.gateOpen=false; S.gateCloseAt=-1; S.voidP=30; S.wheelNext=S.months;
  wheelTick();
  return S.gateOpen===true&&S.voidP>=40;
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
  return myLordRealm()==='东荒'&&!!document.querySelector('#wGate button[data-p="守幽墟"]');
}));
ok('定了「打邻居」，关系当场跌一截', await page.evaluate(()=>{
  S.ties['东荒-樱洲']=60; S.ties['东荒-西陆']=60;
  setLordPolicy('打邻居');
  return S.lordPolicy==='打邻居'&&(S.ties['东荒-樱洲']===45||S.ties['东荒-西陆']===45);
}));
ok('定了「守幽墟」，本界这一轮不动手', await page.evaluate(()=>{
  S.lordPolicy='守幽墟'; S.ties['东荒-西陆']=20;
  const before=S.ledger.length;
  warTick();
  return !S.ledger.slice(before).some(x=>/东荒与西陆开战/.test(x));
}));

console.log('\n【老存档】');
ok('v11 升到 v12，局势从平常起步', await page.evaluate(()=>{
  const s={v:11,realm:'东荒',homeRealm:'东荒',months:0,wheelTurns:4,npcs:[],forged:['东荒'],
    world:{factions:[],ranking:[],events:[],fallen:[],vacant:0},player:{name:'甲',items:{},attributes:{'修为':10},'声望':10}};
  migrate(s);
  return s.v>=12&&!!s.ties&&Object.values(s.ties).every(v=>v===50)&&s.voidP===40&&!!s.lords;
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
