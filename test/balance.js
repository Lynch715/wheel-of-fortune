// 数值跑量（规范 v3.0 第 2 节）：不叫模型，只让引擎空推月份，看压力与界势落在哪儿。
// 用法：LIVES=60 YEARS=30 node test/balance.js
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const {pickBody,sse,serve}=require('./mock');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'));
const srv=http.createServer(serve);
const LIVES=+(process.env.LIVES||60), YEARS=+(process.env.YEARS||30);
(async()=>{
srv.listen(8951);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
const page=await (await br.newContext()).newPage();
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData());
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await page.goto('http://localhost:8951/'); await page.waitForTimeout(400);
await page.click('#jieGrid .jiebtn[data-k="东荒"]'); await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});
const tunes=process.env.SWEEP?JSON.parse(process.env.SWEEP):[{}];
for(const tu of tunes){
const r=await page.evaluate(([L,Y,tu])=>{
  if(!window.__T0) window.__T0=Object.assign({},TUNE); Object.assign(TUNE,window.__T0,tu);
  const snap=JSON.stringify(S);
  let hit60=0, war=0, sumP=0, n=0, maxP=0;
  for(let l=0;l<L;l++){
    S=JSON.parse(snap); S.player.money=1e9; S.player.age=20; S.player.lifespan=999;
    let h=false, w=false;
    for(let m=0;m<Y*12;m++){
      advanceTime(1); S.engineNews=[];
      const p=voidP(); sumP+=p; n++; maxP=Math.max(maxP,p);
      if(p>=60) h=true;
      if(Object.values(S.ties).some(v=>v<40)) w=true;
    }
    if(h) hit60++; if(w) war++;
  }
  return {hit60:hit60/L, war:war/L, avgP:sumP/n, maxP};
},[LIVES,YEARS,tu]);
console.log(JSON.stringify(tu),JSON.stringify(r));
if(!process.env.SWEEP){ const ok=r.hit60>=0.15&&r.hit60<=0.45&&r.war>=0.25&&r.war<=0.7; console.log(ok?'  ✓ 落在范围里（压力摸到 60 的局 15%–45%，开过仗的局 25%–70%）':'  ✗ 超出范围'); process.exitCode=ok?0:1; }
}
await br.close(); srv.close();
})();
