// S18 门派与势力（规范 v3.5 第一批：1—5 节）
const {chromium}=require('playwright');
const http=require('http');
const {pickBody,sse,serve}=require('./mock');
const srv=http.createServer(serve);
const fails=[],oks=[];
const ok=(n,c)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n); };
let page;
const ev=(f,a)=>(a===undefined?page.evaluate(f):page.evaluate(f,a));

(async()=>{
srv.listen(8974);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
page=await (await br.newContext({viewport:{width:1400,height:900}})).newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData());
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await page.goto('http://localhost:8974/'); await page.waitForTimeout(400);
await page.click('#jieGrid .jiebtn[data-k="东荒"]'); await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});

// 把主角调到「够格开山门」的水位；每个小节自己再改
const reset=()=>ev(()=>{
  S.clan=null; S.realm='东荒'; S.homeRealm='东荒'; S.voidP=20; S.gateOpen=false; S.tideSev=0;
  S.player.attributes['修为']=60; S.player.attributes['谈吐']=60; S.player.attributes['学识']=60;
  S.player['声望']=50; S.player.money=5000; S.player.faction='云台观';
  S.sect={name:'云台观',contrib:0,joined:1};
  (S.world.factions||[]).forEach(f=>{ if(f.mine) f.mine=false; });
  S.world.factions=(S.world.factions||[]).filter(f=>!f.mine);
  recalcLords(true);
});
const found=(o)=>ev(x=>foundClan(x), Object.assign({name:'清微剑宗',type:'宗门',align:'正派',base:'云台观'},o||{}));

console.log('\n【一·开办的五道门槛】');
await reset();
await ev(()=>{ S.player.attributes['修为']=5; });
ok('修为不够，说得出还差多少', /修为 .*还差/.test(await ev(()=>clanFoundBlock())));
await reset(); await ev(()=>{ S.player['声望']=10; });
ok('声望不到 35 开不了', /声望 10/.test(await ev(()=>clanFoundBlock())));
await reset(); await ev(()=>{ S.player.money=10; });
ok('银钱不够开不了，且报得出开办费', /银钱 10 两/.test(await ev(()=>clanFoundBlock())));
await reset(); await ev(()=>{ S.realm='幽墟'; });
ok('幽墟不是开宗立派的地方', /幽墟不是/.test(await ev(()=>clanFoundBlock())));
await reset();
ok('四样都够就开得了', (await ev(()=>clanFoundBlock()))==='');
ok('开办费按难度算，寻常档 800 两', (await ev(()=>clanFoundCost()))===800);
ok('修为门槛是当世水位的三成半', await ev(()=>clanWuNeed()===Math.max(8,Math.round(powerLevel()*0.35))));

console.log('\n【二·叛出师门的代价】');
await reset();
let before=await ev(()=>num(S.player['声望']));
await found();
ok('正派叛出掉 10 点声望', (await ev(()=>num(S.player['声望'])))===before-10);
ok('叛出之后没有师门了', await ev(()=>S.sect===null));
ok('同门好感掉 30', await ev(()=>{ const n=findNpc('沈师姐'); return !n||num(n['好感度'])<=25; }));
await reset();
await ev(()=>{ const f=factionOf('云台观'); f.alignment='邪道'; });
before=await ev(()=>num(S.player['声望']));
await found({name:'血影门',align:'邪道'});
ok('邪道叛出不掉声望——那本来就不是讲这个的地方', (await ev(()=>num(S.player['声望'])))===before);
await ev(()=>{ const f=factionOf('云台观'); if(f) f.alignment='正派'; });
await reset();
await ev(()=>{ S.sect.contrib=999; });
before=await ev(()=>num(S.player['声望']));
await found({name:'另起一家'});
ok('本来就是当家的，另立不算叛出', (await ev(()=>num(S.player['声望'])))===before);

console.log('\n【三·开山门之后】');
await reset(); await found();
ok('开局权势 5、弟子 0、人心 60', await ev(()=>{const c=clan();return c.power===5&&c.disciples===0&&c.morale===60;}));
ok('开办费扣了，一半进公中', await ev(()=>clan().treasury===400));
ok('四样都是玩家定的，一字不走模型', await ev(()=>{const c=clan();return c.name==='清微剑宗'&&c.type==='宗门'&&c.align==='正派'&&c.base==='云台观';}));
ok('位阶叫法按类型翻，掌门那一级叫掌教', (await ev(()=>clanHeadTitle()))==='掌教');
ok('门派进了当世格局，leader 是主角', await ev(()=>{const f=factionOf('清微剑宗');return !!f&&f.leader===S.player.name&&f.mine===true&&f.realm==='东荒';}));
ok('主角的 faction 换成了本门', await ev(()=>S.player.faction==='清微剑宗'));
ok('本门不当师门算：不记贡献、不领月例', await ev(()=>{ syncSect(); return S.sect===null&&sectStipend()===0; }));

console.log('\n【四·轮枢：能开，但不入界主之争】');
await reset();
await ev(()=>{ S.realm='轮枢'; });
ok('轮枢开得了山门', (await ev(()=>clanFoundBlock()))==='');
await found({name:'万界镖局',type:'商盟',base:''});
ok('轮枢的门派不算进界主之争', await ev(()=>clanCountsForLord()===false));
ok('轮枢的权势不进势力分', await ev(()=>{ clan().power=90; return playerFactionPower('东荒')===0&&playerFactionPower('轮枢')===0; }));

console.log('\n【五·夺取现有势力】');
await reset();
ok('贡献没到顶接不了', /贡献还没到顶/.test(await ev(()=>clanSeizeBlock())));
await ev(()=>{ S.sect.contrib=999; const f=factionOf('云台观'); f.leader='太上老君'; });
ok('至高那几位不会跟你比一场就让位', /不会跟你比一场就让位/.test(await ev(()=>clanSeizeBlock())));
await ev(()=>{ const f=factionOf('云台观'); f.leader='玄清真人'; const n=findNpc('玄清真人'); if(n) n['修为']=95; });
ok('压不住当家的也接不了', /你还压不住他/.test(await ev(()=>clanSeizeBlock())));
await ev(()=>{ const n=findNpc('玄清真人'); if(n) n['修为']=40; });
ok('贡献到顶、也压得住，就接得了', (await ev(()=>clanSeizeBlock()))==='');
const seized=await ev(()=>{ const p0=num(factionOf('云台观').power); const r=Math.random; Math.random=()=>0.999; const res=clanSeize(); Math.random=r; const c=clan(); return {win:res.win,power:c&&c.power,taken:c&&c.taken,p0:p0,disc:c&&c.disciples}; });
ok('三阵全胜就接了过来', seized.win===true&&seized.taken===true);
ok('接过来的人心浮动，权势当场掉两成', seized.power===Math.round(seized.p0*0.8));
ok('弟子也跟着走了一成半', seized.disc===Math.round(seized.p0*0.6*0.85));
ok('原来那位成了仇家', await ev(()=>(S.vendettas||[]).some(v=>v.name==='玄清真人')));
await reset();
await ev(()=>{ S.sect.contrib=999; const f=factionOf('云台观'); f.leader='玄清真人'; const n=findNpc('玄清真人'); if(n) n['修为']=40; });
ok('三阵全败就没接下来，还要掉贡献', await ev(()=>{ const r=Math.random; Math.random=()=>0; const res=clanSeize(); Math.random=r; return res.win===false&&!hasClan(); }));

console.log('\n【六·招弟子】');
await reset(); await found();
const dc0=await ev(()=>clanRecruitDC());
ok('权势涨了就好招人', await ev(d=>{ clan().power=60; const v=clanRecruitDC(); clan().power=5; return v<d; },dc0));
ok('弟子多了反而难招——山门就这么大', await ev(d=>{ clan().disciples=60; const v=clanRecruitDC(); clan().disciples=0; return v>d; },dc0));
ok('乱世里正派好招人', await ev(d=>{ S.gateOpen=true; S.tideSev=2; const v=clanRecruitDC(); S.gateOpen=false; S.tideSev=0; return v<d; },dc0));
ok('乱世里邪道反过来', await ev(d=>{ clan().align='邪道'; S.gateOpen=true; S.tideSev=2; const v=clanRecruitDC(); S.gateOpen=false; S.tideSev=0; clan().align='正派'; return v>d; },dc0));
ok('招到人了，人数跟着涨', await ev(()=>{ const r=Math.random; Math.random=()=>0.999; const res=clanRecruit(); Math.random=r; return res.n>=5&&clan().disciples===res.n; }));
ok('一个月只开一次山门', (await ev(()=>clanRecruit()))===null);
ok('平均资质是按人数加权的，不是直接覆盖', await ev(()=>{ const c=clan(); c.disciples=10; c.quality=20; clanAddDisciples(10,60); return c.disciples===20&&c.quality===40; }));

console.log('\n【七·授业】');
await reset(); await found();
await ev(()=>{ clan().disciples=20; clan().quality=30; });
ok('授业掷的是学识', (await ev(()=>{ const r=Math.random; Math.random=()=>0.6; const res=clanTeach(); Math.random=r; return res.r.attr; })) === '学识');
ok('讲一课火候涨 2（大成功 4）', await ev(()=>{ const c=clan(); c.quality=30; c.teachCd=-1; const r=Math.random; Math.random=()=>0.999; clanTeach(); Math.random=r; return c.quality===34; }));
ok('一个月只讲一轮', /已经讲过/.test(await ev(()=>clanTeachBlock())));
ok('火候封顶 80，到顶就讲不动了', await ev(()=>{ const c=clan(); c.quality=80; c.teachCd=-1; return /到头了/.test(clanTeachBlock()); }));
ok('亲传多了帮着教，难度降下来', await ev(()=>{ const c=clan(); c.quality=30; const a=clanTeachDC(); c.inner=['甲','乙','丙']; const b=clanTeachDC(); c.inner=[]; return b<a; }));
ok('弟子多了教不过来，难度升上去', await ev(()=>{ const c=clan(); const a=clanTeachDC(); c.disciples=200; const b=clanTeachDC(); c.disciples=20; return b>a; }));

console.log('\n【八·亲传】');
await reset(); await found();
ok('门下不到五个人，拔谁', /不到五个人/.test(await ev(()=>clanPromoteBlock())));
await ev(()=>{ clan().disciples=20; clan().quality=50; });
const pro=await ev(()=>{ const r=Math.random; Math.random=()=>0.999; const res=clanPromote(); Math.random=r; return res.name; });
ok('拔得出一个有名有姓的亲传', !!pro&&(await ev(n=>clan().inner.indexOf(n)>=0,pro)));
ok('拔上来一个，门下就少一个', await ev(()=>clan().disciples===19));
ok('亲传是完整 NPC，进了名录', await ev(n=>{const x=findNpc(n);return !!x&&x.faction===clan().name&&x.relation==='亲传弟子';},pro));
ok('亲传过得了 v3.4 那四道随行门槛', await ev(n=>{const x=findNpc(n);x.follow=false;return followBlock(x)==='';},pro));
ok('亲传封顶五个', await ev(()=>{ const c=clan(); c.inner=['a','b','c','d','e']; return /已经有 5 个/.test(clanPromoteBlock()); }));

console.log('\n【九·公中与私房是两笔账】');
await reset(); await found();
ok('补贴：私房进公中', await ev(()=>{ const m=num(S.player.money); const t=num(clan().treasury); return clanFund(300)&&num(S.player.money)===m-300&&num(clan().treasury)===t+300; }));
ok('支取：公中进私房，人心掉 5', await ev(()=>{ const c=clan(); c.morale=60; c.drawCd=-1; const m=num(S.player.money); return clanDraw(200)&&num(S.player.money)===m+200&&c.morale===55; }));
ok('支取一个月只有一次', (await ev(()=>clanDraw(10)))===false);
ok('公中不够就支不出来', await ev(()=>{ clan().drawCd=-1; return clanDraw(99999)===false; }));
ok('界主月俸进私房，不进公中', await ev(()=>{
  const c=clan(); c.treasury=100; const m=num(S.player.money);
  S.lords={'东荒':{name:S.player.name,isPlayer:true,score:9,rumor:false}}; S.lordSince=num(S.months);
  const r=Math.random; Math.random=()=>0.5; lordMonthly(); Math.random=r;
  const okk=num(S.player.money)>m&&c.treasury===100;
  S.lords={}; S.lordSince=null; return okk; }));

console.log('\n【十·每月结算与人心】');
await reset(); await found();
ok('开销：弟子按火候吃饭（火候越高胃口越大），山门里的亲传每人 8 两', await ev(()=>{
  const c=clan(); c.disciples=30; c.quality=0; c.inner=[];
  const a=clanUpkeep()===Math.round(30*2*0.7);
  c.quality=80; const b=clanUpkeep()===Math.round(30*2*1.5);
  c.quality=0; return a&&b; }));
ok('山门住得下多少人跟着权势走', await ev(()=>{ const c=clan(); c.power=5; const a=clanCap(); c.power=60; const b=clanCap(); c.power=5; return a===45&&b===100&&b>a; }));
ok('山门满了就招不动了', await ev(()=>{ const c=clan(); c.power=5; c.disciples=clanCap(); c.recruitCd=-1; return /住不下了/.test(clanRecruitBlock()); }));
ok('一次至多支走公中的三成', await ev(()=>{ const c=clan(); c.treasury=1000; c.drawCd=-1; return clanDraw(400)===false&&clanDraw(300)===true; }));
ok('跟在身边的亲传吃你那份，不重复算公中', await ev(()=>{
  const c=clan(); c.disciples=0;
  const n=normNpc({name:'随行亲传',gender:'男',age:20,relation:'亲传弟子','好感度':80,'修为':20,faction:c.name,realm:'东荒'});
  n.follow=true; S.npcs.push(n); c.inner=['随行亲传'];
  const a=clanUpkeep(); n.follow=false; const b=clanUpkeep();
  c.inner=[]; S.npcs=S.npcs.filter(x=>x.name!=='随行亲传');
  return a===0&&b===8; }));
ok('进项跟着权势和火候走', await ev(()=>{ const c=clan(); c.disciples=50; c.quality=50; c.power=10; return clanIncome()===Math.round(50*1.2+30); }));
ok('公中空了：欠饷、人心 −15、有人散伙', await ev(()=>{
  const c=clan(); c.disciples=50; c.quality=0; c.power=5; c.treasury=0; c.morale=80; c.arrears=0;
  const d0=c.disciples; clanTick();
  return c.arrears===1&&c.morale<=65&&c.disciples<d0; }));
ok('欠着饷就谈不上太平无事，人心不会自己回来', await ev(()=>{
  const c=clan(); c.morale=5; c.treasury=0; c.disciples=50; c.quality=0; c.power=5;
  clanTick(); return !hasClan(); }));
ok('人心散尽，门就散了——招牌从格局上摘掉', await ev(()=>!factionOf('清微剑宗')));
await reset(); await found();
ok('掌门长年不在本界，人心每月掉 2', await ev(()=>{
  const c=clan(); c.morale=60; c.treasury=99999; c.disciples=0; S.realm='西陆';
  clanTick(); const v=c.morale; S.realm='东荒'; return v===58; }));
ok('在本界又不欠饷，人心每月回 1', await ev(()=>{ const c=clan(); c.morale=60; c.treasury=99999; c.arrears=0; clanTick(); return c.morale===61; }));
ok('声望涨够 10 点，门里也提气', await ev(()=>{ const c=clan(); c.morale=60; c.markFame=num(S.player['声望']); S.player['声望']=num(S.player['声望'])+12; c.treasury=99999; clanTick(); return c.morale>=65; }));

console.log('\n【十一·权势是挪的，不是跳的】');
await reset(); await found();
ok('目标值按弟子/亲传/掌门/声望/战绩五项算', await ev(()=>{
  const c=clan(); c.disciples=50; c.quality=50; c.inner=[]; c.wins=0; c.losses=0;
  const base=Math.min(40,50*0.8), head=Math.min(20,wuNorm(attrVal(S.player,'修为'))*0.20), fame=Math.min(15,num(S.player['声望'])/100*15);
  return clanPowerTarget()===Math.round(clamp(base+0+head+fame+0,0,100)); }));
ok('一个月只挪 1 点——不然招一批人就当场涨七分界主分', await ev(()=>{
  const c=clan(); c.disciples=50; c.power=5; c.treasury=99999; c.morale=60;
  clanTick(); return c.power===6; }));
ok('人心不到 30，权势只降不升', await ev(()=>{
  const c=clan(); c.disciples=50; c.power=6; c.treasury=99999; c.morale=20;
  clanTick(); return c.power===6; }));
ok('目标低于现值就往下走', await ev(()=>{
  const c=clan(); c.disciples=0; c.power=40; c.treasury=99999; c.morale=60;
  clanTick(); return c.power===39; }));

console.log('\n【十二·界主那五成】');
await reset(); await found();
ok('本门权势进势力分', await ev(()=>{ clan().power=60; return playerFactionPower('东荒')===60; }));
ok('势力分封顶 100', await ev(()=>{ clan().power=100; S.sect={name:'云台观',contrib:999}; const v=playerFactionPower('东荒'); S.sect=null; return v===100; }));
ok('界主分公式没动：势力×0.5＋声望×0.3＋修为×0.2', await ev(()=>{
  clan().power=60;
  return playerLordScore()===lordCalc(60,num(S.player['声望']),attrVal(S.player,'修为'),false); }));
ok('异界之身照旧打六折', await ev(()=>{
  clan().power=60; clan().realm='西陆'; S.realm='西陆';
  const v=playerLordScore(), full=lordCalc(60,num(S.player['声望']),attrVal(S.player,'修为'),false);
  S.realm='东荒'; clan().realm='东荒';
  return Math.abs(v-Math.round(full*0.6*10)/10)<0.2; }));
ok('权势够大就坐得上界主', await ev(()=>{
  clan().power=100; clan().realm='东荒'; S.realm='东荒';
  S.player['声望']=100; S.player.attributes['修为']=200; S.fd_grow='free';
  fameSync(); recalcLords(true);
  window.__lord=JSON.stringify(S.lords['东荒'])+' 我='+playerLordScore();
  return isLordOf('东荒'); }));
ok('人在别界时，自己的门派不会在那一界被当成 NPC 推一遍', await ev(()=>{
  S.realm='西陆'; S.forged=(S.forged||[]).concat(['西陆']);
  const pool=lordPool('东荒'); S.realm='东荒';
  return !pool.some(x=>x.name===S.player.name&&!x.isPlayer); }));

console.log('\n【十二之二·至高那几位不当界主】');
await reset();
ok('太上原君这一档（T1 至高）不进界主候选池', await ev(()=>{
  const pool=lordPool('东荒'); return !pool.some(x=>(fameTierOf(x.name)||'')==='T1'); }));
ok('T2 顶尖照旧争——玉皇大帝这样管事的人，本来就该坐这个位子', await ev(()=>{
  const pool=lordPool('东荒'); return pool.some(x=>(fameTierOf(x.name)||'')==='T2'); }));
ok('候选池里一个至高都没有', await ev(()=>lordPool('东荒').every(x=>x.isPlayer||!lordAloof(x.name))));
ok('位子于是落到至高之下的人手里', await ev(()=>{
  recalcLords(true); const l=S.lords['东荒']; return !!l&&!l.rumor&&!lordAloof(l.name); }));
ok('修为声望拉满、门派也做到顶，才够得着——不是建个门派就白送', await ev(()=>{
  foundClan({name:'够得着门',type:'宗门',align:'正派',base:''});
  S.fd_grow='mid'; S.player['声望']=100; S.player.attributes['修为']=100; fameSync();
  let need=0;
  for(let p=10;p<=100;p+=5){ clan().power=p; recalcLords(true); if(isLordOf('东荒')){ need=p; break; } }
  window.__need=need;
  return need>=40&&need<=100; }));
ok('只把门派做起来、修为声望平平，还差一口气', await ev(()=>{
  S.player['声望']=60; S.player.attributes['修为']=70; fameSync();
  clan().power=70; recalcLords(true); return !isLordOf('东荒'); }));

console.log('\n【十三·提示词】');
await reset(); await found();
await ev(()=>{ const c=clan(); c.disciples=37; c.quality=40; c.power=42; c.morale=66; c.treasury=1280; });
const tp=await ev(()=>turnPrompt('试',{fate:10,days:1}));
ok('【本门】块在提示词里', tp.indexOf('【本门】')>=0);
ok('放在【当前时间】之后，不破前缀缓存', tp.indexOf('【本门】')>tp.indexOf('【当前时间】'));
ok('还在【当前场景】之前，跟局势块挨着', tp.indexOf('【本门】')<tp.indexOf('【当前场景】'));
ok('几个数都写进去了', /权势42/.test(tp)&&/弟子37人/.test(tp)&&/人心66/.test(tp)&&/公中1280两/.test(tp));
ok('钉了那句：别给普通弟子起名字', /不要给普通弟子起名字/.test(tp));
ok('没有门派的时候，这一块整个不出现', await ev(()=>{ S.clan=null; return turnPrompt('试',{fate:10,days:1}).indexOf('【本门】')<0; }));
ok('提示词没胖失控（<18500）', tp.length<18500);

console.log('\n【十四·存档】');
ok('存档到 v25', await ev(()=>SAVE_VERSION===25));
ok('老档没有门派，迁上来是 null', await ev(()=>{
  const d=JSON.parse(JSON.stringify(S)); d.v=23; delete d.clan; d.sect=null;
  const m=migrate(d); return m.v===25&&m.clan===null; }));
ok('老档里贡献早就到顶的，直接补上门派身份，不倒扣那两成', await ev(()=>{
  const d=JSON.parse(JSON.stringify(S)); d.v=23; delete d.clan;
  d.sect={name:'云台观',contrib:999,joined:1};
  const f=(d.world.factions||[]).find(x=>x.name==='云台观'); if(!f) return false;
  const p0=num(f.power);
  const m=migrate(d);
  return !!m.clan&&m.clan.name==='云台观'&&m.clan.power===p0&&m.clan.taken===true&&m.sect===null; }));

console.log('\n【十五·界面】');
await reset();
await ev(()=>{ renderWorld(); });
ok('没门派时，本门卡写着还没有门户，且开得了的按钮能点', await ev(()=>{
  const s=$('clanSub').textContent, b=$('clanFoundBtn');
  return /还没有门户/.test(s)&&!!b&&!b.disabled; }));
ok('条件不够时按钮是灰的，底下写明差在哪', await ev(()=>{
  S.player.money=10; renderWorld();
  const b=$('clanFoundBtn');
  return !!b&&b.disabled===true&&/银钱 10 两/.test($('clanBody').textContent); }));
await reset(); await found();
await ev(()=>{ const c=clan(); c.disciples=37; c.quality=40; c.power=42; c.morale=66; c.treasury=1280; renderWorld(); });
ok('有门派时，卡上几个数都在', await ev(()=>{
  const t=$('clanBody').textContent;
  return /37/.test(t)&&/66/.test(t)&&/1280/.test(t)&&/42/.test(t); }));
ok('三个按钮都在（收徒、授业、拔擢）', await ev(()=>!!$('clanRecruitBtn')&&!!$('clanTeachBtn')&&!!$('clanPromoteBtn')));
ok('人不在本界，门里的事就办不了', await ev(()=>{
  S.realm='西陆'; renderWorld();
  const okk=$('clanRecruitBtn').disabled&&$('clanTeachBtn').disabled&&/管不着/.test($('clanBody').textContent);
  S.realm='东荒'; renderWorld(); return okk; }));
ok('开宗立派的弹窗打得开，四样都能点', await ev(()=>{
  S.clan=null; S.player.money=5000; renderWorld(); openClanFound();
  const on=$('clanMask').classList.contains('on');
  const segs=$('clanFoundBody').querySelectorAll('.cseg').length;
  const hasName=!!$('clanName');
  $('clanMask').classList.remove('on');
  return on&&segs>3&&hasName; }));
ok('字号不能空', await ev(()=>{
  S.clan=null; S.player.money=5000; renderWorld(); openClanFound();
  $('clanName').value=''; doClanFound();
  return !hasClan(); }));
ok('同名的一家已经有了就不许再立', await ev(()=>{
  $('clanName').value='清微剑宗'; doClanFound(); return !hasClan(); }));
ok('字号不能用别界的词', await ev(()=>{
  $('clanName').value='魔法塔'; doClanFound(); return !hasClan(); }));
ok('起个新字号就立得起来', await ev(()=>{
  $('clanName').value='松风剑庐'; doClanFound();
  const okk=hasClan()&&clan().name==='松风剑庐'&&!$('clanMask').classList.contains('on');
  return okk; }));

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(fails.length) console.log('lord=',await ev(()=>window.__lord),' need=',await ev(()=>window.__need));
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
ok('全程无页面报错', errs.length===0);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})();
