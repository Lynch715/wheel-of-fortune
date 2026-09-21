// S19 门派对战 · NPC 互掐 · 界主还手（规范 v3.5 第 6 节，第二批）
const {chromium}=require('playwright');
const http=require('http');
const {pickBody,sse,serve}=require('./mock');
const srv=http.createServer(serve);
const fails=[],oks=[];
const ok=(n,c)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n); };
let page;
const ev=(f,a)=>(a===undefined?page.evaluate(f):page.evaluate(f,a));

(async()=>{
srv.listen(8978);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
page=await (await br.newContext({viewport:{width:1400,height:900}})).newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData());
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await page.goto('http://localhost:8978/'); await page.waitForTimeout(400);
await page.click('#jieGrid .jiebtn[data-k="东荒"]'); await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});

// 每节前的场面：一个权势 50 的本门，外加一家权势 60、当家的不是名人的「风雷堂」
const reset=()=>ev(()=>{
  S.realm='东荒'; S.homeRealm='东荒'; S.over=false; S.months=24; S.day=0;
  S.player.attributes['修为']=60; S.player.attributes['谈吐']=60; S.player.attributes['学识']=60;
  S.player['声望']=50; S.player['恶名']=0; S.player.money=9000; S.player.hp=100; S.player.faction='散人';
  S.sect=null; S.clan=null; S.vendettas=[];
  S.world.factions=factionSeed('东荒');
  S.npcs=S.npcs.filter(n=>n.name!=='雷老三'&&n.relation!=='亲传弟子');
  S.npcs.push(normNpc({name:'雷老三',gender:'男',age:50,relation:'素未谋面',identity:'风雷堂堂主','好感度':30,'修为':55,faction:'风雷堂',realm:'东荒',alignment:'邪道'}));
  S.world.factions.push({name:'风雷堂',type:'宗门',realm:'东荒',alignment:'邪道',power:60,leader:'雷老三',desc:'东荒一支不大不小的邪道'});
  foundClan({name:'清微剑宗',type:'宗门',align:'正派',base:'云台观'});
  const c=clan(); c.power=50; c.disciples=40; c.quality=50; c.morale=70; c.treasury=2000;
  c.wars={}; c.lastWar=null; c.ally=''; c.press=null; c.pressCd=null; c.lordWarDue=null;
  recalcLords(true);
});
const win=f=>ev(x=>{ const r=Math.random; Math.random=()=>0.999; const res=eval(x); Math.random=r; return res; }, f);
const lose=f=>ev(x=>{ const r=Math.random; Math.random=()=>0; const res=eval(x); Math.random=r; return res; }, f);

console.log('\n【一·宣战的门槛】');
await reset();
ok('本界的别家列得出来', await ev(()=>clanWarTargets().some(t=>t.f.name==='风雷堂')));
ok('打得了风雷堂', (await ev(()=>clanWarBlock(factionOf('风雷堂'))))==='');
ok('总不能打自己', /不能打自己/.test(await ev(()=>clanWarBlock(factionOf('清微剑宗')))));
ok('太上老君那一档不跟你这一门较真', await ev(()=>{
  const f=(S.world.factions||[]).find(x=>x.leader&&fameTierOf(x.leader)==='T1');
  return !!f&&/不会跟你这一门较真/.test(clanWarBlock(f)); }));
ok('人不在本界，隔着界发不了兵', await ev(()=>{ S.realm='西陆'; const w=clanWarBlock(factionOf('风雷堂')); S.realm='东荒'; return /隔着界/.test(w); }));
ok('人心都要散了就不许动手', await ev(()=>{ clan().morale=20; const w=clanWarBlock(factionOf('风雷堂')); clan().morale=70; return /找死/.test(w); }));
ok('有盟约的不打', await ev(()=>{ clan().ally='风雷堂'; const w=clanWarBlock(factionOf('风雷堂')); clan().ally=''; return /盟约/.test(w); }));
ok('同一家十二个月内不能再打', await ev(()=>{ const c=clan(); c.wars={'风雷堂':num(S.months)-5}; c.lastWar=null; const w=clanWarBlock(factionOf('风雷堂')); c.wars={}; return /还要 7 个月/.test(w); }));
ok('任何一场之后本门六个月不宣战', await ev(()=>{ const c=clan(); c.lastWar=num(S.months)-2; const w=clanWarBlock(factionOf('风雷堂')); c.lastWar=null; return /还要 4 个月/.test(w); }));

console.log('\n【二·三阵取两胜】');
await reset();
const rr=await ev(()=>{ const r=Math.random; Math.random=()=>0.5; const res=clanFight3({wu:50,force:40,power:60},clanMineSide()); Math.random=r; return res.rolls.map(x=>x.attr); });
ok('一掌门阵二门人阵掷修为，三声势阵掷谈吐', rr[0]==='修为'&&rr[1]==='修为'&&rr[2]==='谈吐');
ok('三阵里胜两阵就算赢', await ev(()=>{
  let a=0,b=0; const r=Math.random;
  Math.random=()=>0.999; a=clanFight3({wu:50,force:40,power:60},clanMineSide()).win?1:0;
  Math.random=()=>0;     b=clanFight3({wu:50,force:40,power:60},clanMineSide()).win?1:0;
  Math.random=r; return a===1&&b===0; }));
ok('派亲传上掌门阵，第一阵按他的修为算', await ev(()=>{
  const ch={name:'某亲传','修为':20};
  const r=Math.random; Math.random=()=>0.5;
  const a=clanFight3({wu:80,force:40,power:60},clanMineSide()).rolls[0].need;
  const b=clanFight3({wu:80,force:40,power:60},clanMineSide(),ch).rolls[0].need;
  Math.random=r; return b>a; }));
ok('门战力＝权势一半＋弟子＋亲传修为', await ev(()=>{
  const c=clan();
  return clanForceOf(c)===Math.round(num(c.power)*0.5+Math.min(20,num(c.disciples)*0.3)+Math.min(20,wuNorm(clanInnerWu())/100*20)); }));

console.log('\n【三·打赢了：吞一半】');
await reset();
const w1=await ev(()=>{
  const c=clan(), f=factionOf('风雷堂'), p0=num(f.power), my0=num(c.power), d0=num(c.disciples), fame0=num(S.player['声望']);
  const r=Math.random; Math.random=()=>0.999; const res=clanWar('风雷堂'); Math.random=r;
  return {win:res.win, p0:p0, fp:num(factionOf('风雷堂').power), my0:my0, my:num(c.power),
          d0:d0, d:num(c.disciples), fame0:fame0, fame:num(S.player['声望']), wins:num(c.wins), morale:num(c.morale)}; });
ok('三阵全胜就赢了', w1.win===true);
ok('对方权势砍半', w1.fp===Math.round(w1.p0-w1.p0*0.5));
ok('砍掉那一半里六成并进本门', w1.my===Math.min(100,w1.my0+Math.round(w1.p0*0.5*0.6)));
ok('对方弟子来三成', w1.d>w1.d0);
ok('邪道被正派打，声望 +8 不落恶名', w1.fame===w1.fame0+8);
ok('战绩记了一胜，人心 +10', w1.wins===1&&w1.morale>=79);
ok('对方当家的成了仇家、好感掉 50', await ev(()=>{
  const n=findNpc('雷老三');
  return (S.vendettas||[]).some(v=>v.name==='雷老三')&&num(n['好感度'])<=0; }));
ok('势力分封顶 100——吞到头就到头了', await ev(()=>{
  const c=clan(); c.power=95; c.wars={}; c.lastWar=null;
  const f=factionOf('风雷堂'); f.power=80;
  const r=Math.random; Math.random=()=>0.999; clanWar('风雷堂'); Math.random=r;
  return num(c.power)===100&&playerFactionPower('东荒')===100; }));

console.log('\n【四·欺负人不算本事】');
await reset();
await ev(()=>{ const f=factionOf('风雷堂'); f.alignment='正派'; });
const w2=await ev(()=>{
  const e0=num(S.player['恶名']), f0=num(S.player['声望']);
  const r=Math.random; Math.random=()=>0.999; clanWar('风雷堂'); Math.random=r;
  return {e0:e0, e:num(S.player['恶名']), f0:f0, f:num(S.player['声望'])}; });
ok('正派打正派：恶名 +5，声望只给 3', w2.e===w2.e0+5&&w2.f===w2.f0+3);
await reset();
await ev(()=>{ clan().power=90; factionOf('风雷堂').power=15; });
const w3=await ev(()=>{
  const e0=num(S.player['恶名']);
  const r=Math.random; Math.random=()=>0.999; clanWar('风雷堂'); Math.random=r;
  return num(S.player['恶名'])-e0; });
ok('打一个权势比自己低三十以上的，也算欺负人', w3===5);
ok('对方权势跌破 10 就散了，从格局上摘掉', await ev(()=>!factionOf('风雷堂')));

console.log('\n【五·打输了】');
await reset();
const l1=await ev(()=>{
  const c=clan(), my0=num(c.power), d0=num(c.disciples), m0=num(c.morale), hp0=num(S.player.hp);
  const r=Math.random; Math.random=()=>0; const res=clanWar('风雷堂'); Math.random=r;
  return {win:res.win, my0:my0, my:num(c.power), d0:d0, d:num(c.disciples), m0:m0, m:num(c.morale),
          hp0:hp0, hp:num(S.player.hp), losses:num(c.losses)}; });
ok('三阵全败就是输', l1.win===false);
ok('本门权势掉两成', l1.my===Math.floor(l1.my0*0.8));
ok('散了两成弟子', l1.d===l1.d0-Math.round(l1.d0*0.2));
ok('人心 −20', l1.m===l1.m0-20);
ok('掌门阵输了，自己上的就自己挨', l1.hp<l1.hp0);
ok('战绩记了一负', l1.losses===1);
await reset();
ok('派亲传上，输了伤在他身上，主角不掉血', await ev(()=>{
  const c=clan(); c.disciples=20; c.quality=50;
  const r0=Math.random; Math.random=()=>0.999; clanPromote(); Math.random=r0;
  const nm=c.inner[0]; if(!nm) return false;
  const g=findNpc(nm), wu0=num(g['修为']), hp0=num(S.player.hp);
  c.wars={}; c.lastWar=null;
  const r=Math.random; Math.random=()=>0; clanWar('风雷堂',nm); Math.random=r;
  return num(S.player.hp)===hp0&&(!g.alive||num(g['修为'])<wu0); }));
await reset();
ok('权势被打到 0，门就没了', await ev(()=>{
  const c=clan(); c.power=1; c.morale=70;
  const r=Math.random; Math.random=()=>0; clanWar('风雷堂'); Math.random=r;
  return !hasClan()&&!factionOf('清微剑宗'); }));

console.log('\n【六·NPC 势力之间也要打】');
await reset();
ok('权势差二十以上的两家不会打', await ev(()=>{
  S.world.factions=(S.world.factions||[]).filter(f=>f.mine||f.name==='风雷堂');
  S.world.factions.push({name:'小门小户',type:'宗门',realm:'东荒',alignment:'正派',power:10,leader:'张三',desc:''});
  const a=num(factionOf('风雷堂').power), b=num(factionOf('小门小户').power);
  const r=Math.random; Math.random=()=>0.01; for(let i=0;i<20;i++) clanNpcWarTick(); Math.random=r;
  return num(factionOf('风雷堂').power)===a&&num(factionOf('小门小户').power)===b; }));
ok('权势相近且正邪不同的两家会打，赢家吃两成的六成', await ev(()=>{
  factionOf('小门小户').power=55;
  const before=num(factionOf('风雷堂').power)+num(factionOf('小门小户').power);
  const r=Math.random; Math.random=()=>0.01; clanNpcWarTick(); Math.random=r;
  const after=num(factionOf('风雷堂').power)+num(factionOf('小门小户').power);
  return after<before&&after>before-30; }));
ok('当家的是名人（T1-T3）就不掺和', await ev(()=>{
  S.world.factions=(S.world.factions||[]).filter(f=>f.mine);
  S.world.factions.push({name:'甲',realm:'东荒',alignment:'正派',power:50,leader:'太上老君',desc:''});
  S.world.factions.push({name:'乙',realm:'东荒',alignment:'邪道',power:50,leader:'元始天尊',desc:''});
  const r=Math.random; Math.random=()=>0.01; for(let i=0;i<20;i++) clanNpcWarTick(); Math.random=r;
  return num(factionOf('甲').power)===50&&num(factionOf('乙').power)===50; }));

console.log('\n【七·在位界主来收拾你】');
await reset();
ok('自己就是界主，没人来找', await ev(()=>{
  S.lords['东荒']={name:S.player.name,isPlayer:true,score:99,rumor:false};
  clan().pressCd=null;
  const r=Math.random; Math.random=()=>0.01; lordPressTick(); Math.random=r;
  return !clan().press; }));
ok('轮枢不设界主，那儿的门派没人来找', await ev(()=>{
  S.lords={}; recalcLords(true);
  clan().realm='轮枢'; clan().pressCd=null;
  const r=Math.random; Math.random=()=>0.01; lordPressTick(); Math.random=r;
  const okk=!clan().press; clan().realm='东荒'; return okk; }));
await reset();
const pr=await ev(()=>{
  const l=S.lords['东荒'];
  const n=findNpc(l.name)||normNpc({name:l.name,gender:'男',age:60,relation:'素未谋面','好感度':25,'修为':80,realm:'东荒'});
  if(!findNpc(l.name)) S.npcs.push(n);
  n['好感度']=22;
  clan().power=80; clan().pressCd=null;
  const r=Math.random; Math.random=()=>0.01; lordPressTick(); Math.random=r;
  const p=clan().press;
  return {has:!!p, kind:p&&p.kind, from:p&&p.from, money:p&&p.money, rank:clanRankIn('东荒')};
});
ok('门派进了前三，界主就找上门了', pr.has===true&&pr.rank<=3);
ok('好感不高不低又不同路，来的是施压', pr.kind==='压');
ok('要的钱是公中的三成', pr.money===Math.round(2000*0.3));
ok('交钱：公中少三成，界主好感回一点', await ev(()=>{
  const c=clan(), t0=num(c.treasury), n=findNpc(c.press.from), f0=n?num(n['好感度']):0;
  answerPress('钱');
  return num(c.treasury)===t0-Math.round(t0*0.3)&&(!n||num(n['好感度'])===f0+15); }));
await reset();
ok('回绝：好感暴跌，且十二个月内他必来', await ev(()=>{
  const c=clan(); const l=S.lords['东荒'];
  const n=findNpc(l.name); if(n) n['好感度']=22;
  c.power=80; c.pressCd=null;
  const r=Math.random; Math.random=()=>0.01; lordPressTick(); Math.random=r;
  if(!c.press) return false;
  answerPress('拒');
  return c.lordWarDue!=null&&num(c.lordWarDue)-num(S.months)<=12; }));
ok('到日子他真的打上门来', await ev(()=>{
  const c=clan(); S.months=num(c.lordWarDue);
  const m0=num(c.morale);
  const r=Math.random; Math.random=()=>0; lordPressTick(); Math.random=r;
  return c===clan()?(num(c.morale)<m0||!hasClan()):!hasClan(); }));
await reset();
ok('交人：亲传少一个，关系改成旧识', await ev(()=>{
  const c=clan(); c.disciples=20; c.quality=50;
  const r0=Math.random; Math.random=()=>0.999; clanPromote(); Math.random=r0;
  const nm=c.inner[0]; if(!nm) return false;
  const l=S.lords['东荒']; const n=findNpc(l.name); if(n) n['好感度']=22;
  c.power=80; c.pressCd=null;
  const r=Math.random; Math.random=()=>0.01; lordPressTick(); Math.random=r;
  if(!c.press||c.press.kind!=='压') return false;
  answerPress('人');
  const g=findNpc(nm);
  return c.inner.indexOf(nm)<0&&g&&g.relation==='旧识'; }));
await reset();
ok('投效：门派并进去，你降做长老', await ev(()=>{
  const c=clan(); const l=S.lords['东荒']; const n=findNpc(l.name); if(n) n['好感度']=22;
  c.power=80; c.pressCd=null;
  const r=Math.random; Math.random=()=>0.01; lordPressTick(); Math.random=r;
  if(!c.press||c.press.kind!=='压') return false;
  answerPress('投');
  return !hasClan()&&!!S.sect&&sectLevel(num(S.sect.contrib))===SECT_STEPS.length-2; }));
await reset();
ok('好感够高，来的是拉拢；结盟涨权势但盟友那份不算你的', await ev(()=>{
  const c=clan(); const l=S.lords['东荒']; const n=findNpc(l.name);
  if(!n) return false;
  n['好感度']=70; c.power=80; c.pressCd=null;
  const r=Math.random; Math.random=()=>0.01; lordPressTick(); Math.random=r;
  if(!c.press||c.press.kind!=='拉') return false;
  const p0=num(c.power);
  answerPress('应');
  const lf=lordFactionOf(l.name,'东荒');
  return c.ally===l.name&&num(c.power)===p0+5&&playerFactionPower('东荒')===num(c.power); }));
await reset();
ok('来使搁三个月不回话，当回绝', await ev(()=>{
  const c=clan(); const l=S.lords['东荒']; const n=findNpc(l.name); if(n) n['好感度']=22;
  c.power=80; c.pressCd=null;
  const r=Math.random; Math.random=()=>0.01; lordPressTick(); Math.random=r;
  if(!c.press) return false;
  c.press.at=num(S.months)-CLAN_PRESS_WAIT;
  c.treasury=99999; clanTick();
  return !clan().press&&clan().lordWarDue!=null; }));

console.log('\n【八·提示词】');
await reset();
const tp=await ev(()=>{
  const c=clan(); c.ally='风雷堂'; c.wars={'某某门':num(S.months)-3};
  return turnPrompt('试',{fate:10,days:1}); });
ok('盟约进了【本门】块', /与风雷堂有盟约/.test(tp));
ok('近一年动过手的也写进去了', /某某门/.test(tp));
ok('还是在【当前时间】之后，前缀缓存没破', tp.indexOf('【本门】')>tp.indexOf('【当前时间】'));
ok('【本门】那一块最胖也不过四百字', await ev(()=>{
  const c=clan();
  c.press={kind:'压',from:'某界主',at:num(S.months),money:300,champ:'',text:'要本门投效'};
  c.lordWarDue=num(S.months)+4;
  const n=clanPromptBlock().length; c.press=null; c.lordWarDue=null;
  window.__cb=n; return n<=400; }));
console.log('     本门块 '+(await ev(()=>window.__cb))+' 字');
ok('界主来使等着回话，模型知道', await ev(()=>{
  const c=clan();
  c.press={kind:'压',from:'某界主',at:num(S.months),money:300,champ:'',text:'要本门投效'};
  const t=turnPrompt('试',{fate:10,days:1});
  c.press=null;
  return /某界主派来的人还等在山门外/.test(t); }));

console.log('\n【九·存档】');
ok('存档到 v25', await ev(()=>SAVE_VERSION===25));
ok('v24 的老门派补上战事那几栏', await ev(()=>{
  const d=JSON.parse(JSON.stringify(S)); d.v=24;
  delete d.clan.wars; delete d.clan.ally; delete d.clan.press; delete d.clan.lordWarDue;
  const m=migrate(d);
  return m.v===25&&!!m.clan.wars&&m.clan.ally===''&&m.clan.press===null&&m.clan.lordWarDue===null; }));

console.log('\n【十·界面】');
await reset();
ok('本门卡上有宣战按钮', await ev(()=>{ renderWorld(); const b=$('clanWarBtn'); return !!b&&!b.disabled; }));
ok('宣战弹窗列得出对手，也挑得了替你上阵的人', await ev(()=>{
  const c=clan(); c.disciples=20; c.quality=50;
  const r=Math.random; Math.random=()=>0.999; clanPromote(); Math.random=r;
  openClanWar();
  const on=$('clanWarMask').classList.contains('on');
  const rows=$('clanWarBody').querySelectorAll('.crossopt').length;
  const segs=$('clanWarBody').querySelectorAll('.cseg').length;
  return on&&rows>0&&segs>=2; }));
ok('挑中一家之后，按钮打得下去，战报三行', await ev(()=>{
  warPick.foe='风雷堂'; warPick.champ='';
  const r=Math.random; Math.random=()=>0.999; doClanWar(); Math.random=r;
  const rows=$('clanWarBody').querySelectorAll('.warrow').length;
  $('clanWarMask').classList.remove('on');
  return rows===3; }));
await reset();
ok('界主来使时，三个选项直接摆在本门卡上', await ev(()=>{
  const c=clan(); const l=S.lords['东荒']; const n=findNpc(l.name); if(n) n['好感度']=22;
  c.power=80; c.pressCd=null;
  const r=Math.random; Math.random=()=>0.01; lordPressTick(); Math.random=r;
  renderWorld();
  return $('clanBody').querySelectorAll('button[data-press]').length>=3; }));

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
ok('全程无页面报错', errs.length===0);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})();
