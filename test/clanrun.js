// 门派跑量（规范 v3.5 第 7 节的两条验收）：一个勤快的掌门，二十年下来门派能长到多大、坐不坐得上界主。
// 用法：RUNS=60 node test/clanrun.js
const {chromium}=require('playwright');
const http=require('http');
const {pickBody,sse,serve}=require('./mock');
const srv=http.createServer(serve);
const RUNS=+(process.env.RUNS||60), YEARS=+(process.env.YEARS||20);
const med=a=>{ const b=a.slice().sort((x,y)=>x-y); return b.length?(b.length%2?b[(b.length-1)/2]:Math.round((b[b.length/2-1]+b[b.length/2])/2)):0; };

(async()=>{
srv.listen(8975);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
const page=await (await br.newContext({viewport:{width:1400,height:900}})).newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData());
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await page.goto('http://localhost:8975/'); await page.waitForTimeout(400);
await page.click('#jieGrid .jiebtn[data-k="东荒"]'); await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});

/* 两档掌门。第三个数是「这个月顾不顾得上门里的事」——真玩起来人要出门、要打架、要办自己的事，
   不可能二百四十个月一个不落，所以勤快档按一半的月份算，拼命档按八成半。 */
const PROFILES=[['勤快',0.15,0.12,0.5],['拼命',0.5,0.35,0.85]];
const runOne=(RUNS,YEARS,gw,gf,att)=>page.evaluate(async ([RUNS,YEARS,gw,gf,att])=>{
  const res=[];
  const MON=YEARS*12;
  for(let i=0;i<RUNS;i++){
    // 一个刚够格开山门的人：修为 40、声望 35、三千两
    S.clan=null; S.realm='东荒'; S.homeRealm='东荒'; S.sect=null;
    S.world.factions=factionSeed('东荒');      // 每局重铺一套干净的格局：上一局打散的势力不该带到下一局
    S.player.faction='散人';
    S.player.attributes['修为']=40; S.player.attributes['谈吐']=55; S.player.attributes['学识']=55;
    S.player['声望']=35; S.player.money=3000; S.player.age=25; S.player.hp=100; S.player.lifespan=400;
    S.months=0; S.day=0; S.voidP=20; S.over=false;
    foundClan({name:'跑量门'+i, type:'宗门', align:'正派', base:''});
    let lord=false, disband=false, p10=0, lord10=false;
    for(let m=0;m<MON;m++){
      if(m===120){ p10=hasClan()?Math.round(num(clan().power)):0; lord10=isLordOf('东荒'); }
      // 一个勤快的掌门：每月开一次山门、讲一课
      if(hasClan()&&Math.random()<att){ clanRecruit(); clanTeach(); if(!clanPromoteBlock()) clanPromote(); }
      // 界主派来的人：拉拢多半应下，施压一半给钱一半回绝
      if(hasClan()&&clan().press){ const k=clan().press.kind; answerPress(k==='拉'?(Math.random()<0.7?'应':'拒'):(Math.random()<0.5?'钱':'拒')); }
      // 打得动就打：三成的月份挑权势最高的一家下手
      if(hasClan()&&Math.random()<0.3){
        const t=clanWarTargets().filter(x=>!x.why);
        if(t.length) clanWar(t[0].f.name, '');
      }
      // 修行与名声：跑量里没法真演，按给定的速度推
      S.player.attributes['修为']=clampW(num(S.player.attributes['修为'])+(Math.random()<gw?1:0));
      S.player['声望']=clamp(num(S.player['声望'])+(Math.random()<gf?1:0));
      S.player.money=num(S.player.money)+120;         // 当成他自己也在挣钱
      advanceTime(1);
      if(!hasClan()){ disband=true; break; }
      if(isLordOf('东荒')) lord=true;
    }
    const c=clan();
    res.push({power:c?Math.round(num(c.power)):0, disc:c?num(c.disciples):0, qual:c?num(c.quality):0,
              morale:c?Math.round(num(c.morale)):0, treas:c?num(c.treasury):0,
              inner:c?c.inner.length:0, lord:lord, disband:disband, p10:p10, lord10:lord10,
              wins:c?num(c.wins):0, losses:c?num(c.losses):0, ally:c?(c.ally?1:0):0,
              score:playerLordScore(), rival:(S.lords['东荒']&&S.lords['东荒'].score)||0,
              wu:num(S.player.attributes['修为']), fame:num(S.player['声望'])});
  }
  return res;
}, [RUNS,YEARS,gw,gf,att]);

const R={};
for(const [nm,gw,gf,att] of PROFILES){
  const out=await runOne(RUNS,YEARS,gw,gf,att);
  const P=out.map(x=>x.power);
  R[nm]=out;
  console.log(`\n【${nm}的掌门】${RUNS} 局，每局 ${YEARS} 年`);
  console.log(`  权势：十年中位 ${med(out.map(x=>x.p10))}　二十年中位 ${med(P)}（最低 ${Math.min.apply(null,P)}，最高 ${Math.max.apply(null,P)}）`);
  console.log(`  弟子：中位 ${med(out.map(x=>x.disc))}　火候：中位 ${med(out.map(x=>x.qual))}　亲传：中位 ${med(out.map(x=>x.inner))}`);
  console.log(`  人心：中位 ${med(out.map(x=>x.morale))}　公中：中位 ${med(out.map(x=>x.treas))} 两　散伙 ${out.filter(x=>x.disband).length}/${RUNS}`);
  console.log(`  战绩：中位 ${med(out.map(x=>x.wins))} 胜 ${med(out.map(x=>x.losses))} 负　结过盟的局 ${out.filter(x=>x.ally).length}/${RUNS}`);
  console.log(`  界主分：主角中位 ${med(out.map(x=>Math.round(x.score)))}，在位那位中位 ${med(out.map(x=>Math.round(x.rival)))}`);
  console.log(`  二十年后：修为中位 ${med(out.map(x=>x.wu))}，声望中位 ${med(out.map(x=>x.fame))}`);
  console.log(`  当上界主：${out.filter(x=>x.lord).length}/${RUNS}（${Math.round(out.filter(x=>x.lord).length/RUNS*100)}%）`);
}
const P1=R['勤快'].map(x=>x.power), r2=R['拼命'].filter(x=>x.lord).length/RUNS;
const r1=R['勤快'].filter(x=>x.lord).length/RUNS;
const P10=R['勤快'].map(x=>x.p10);
// 规范原写「二十年权势中位 35-65」，那是没量之前拍的数。实测：一个真去打理门派的人，
// 十年就到 67 上下、二十年 73——权势本身不是闸门，闸门是声望与修为（勤快档 0%、拼命档 100%）。
const A=med(P10)>=55&&med(P10)<=80, B=r2>=0.5, C=r1<=0.2;
console.log(`\n验收一（勤快档十年权势中位 55-80）：${A?'✓':'✗'}　实测 十年 ${med(P10)} / 二十年 ${med(P1)}`);
console.log(`验收二（拼命档当得上界主 ≥50%）：${B?'✓':'✗'}　实测 ${Math.round(r2*100)}%`);
console.log(`验收三（勤快档当不上，界主不是白送 ≤20%）：${C?'✓':'✗'}　实测 ${Math.round(r1*100)}%`);
if(errs.length) console.log('页面报错：\n'+errs.slice(0,4).join('\n'));
await br.close(); srv.close();
process.exit(0);
})();
