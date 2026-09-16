// 跑量：三个可投胎的界各 N 局，每局十余回合，中途换界、下幽墟、随机自由度组合。
// 只找三样东西：页面报错、跨界泄漏、跑崩。用法：RUNS=20 node test/run.js
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const {pickBody,sse}=require('./mock');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'));
const srv=http.createServer((q,r)=>{ r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); r.end(html); });

const RUNS=+(process.env.RUNS||20), TURNS=+(process.env.TURNS||12);
const BIRTH=['东荒','西陆','樱洲'];
const LEAK={
  '东荒':['魔法','魔力','魔导','斗气','骑士','教廷','咒力','式神','阴阳师','忍者'],
  '西陆':['金丹','元婴','化神','道友','仙子','符箓','咒力','式神','幕府','忍者'],
  '樱洲':['魔法','魔力','魔导','斗气','骑士','教廷','金丹','元婴','道友','仙子'],
  '轮枢':[],
  '幽墟':['金丹','元婴','化神','道友','仙子','魔法','魔力','魔导','骑士','教廷','式神','阴阳师','幕府']
};
const FREE=['free','mid','strict'], DIFF=['easy','normal','hard'];
const pick=a=>a[Math.floor(Math.random()*a.length)];
const FREE_ACTS=['在附近打听打听','就留在这儿，接着练','去找个人说说话','把手上的事做完','四下走走看看','闭门养伤'];

(async()=>{
srv.listen(8937);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
const bad=[], stat={runs:0,turns:0,crosses:0,abyss:0,maxPrompt:0};
const t0=Date.now();

for(const birth of BIRTH){
  for(let r=0;r<RUNS;r++){
    const tag=`${birth}#${r+1}`;
    const ctx=await br.newContext({viewport:{width:1400,height:900}});
    const page=await ctx.newPage();
    const errs=[];
    page.on('pageerror',e=>errs.push(String(e)));
    page.on('console',m=>{ if(m.type()==='error'&&!/Failed to load resource/.test(m.text())) errs.push('console:'+m.text()); });
    await page.route('**/chat/completions',async route=>{
      const b=JSON.parse(route.request().postData());
      await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))});
    });
    await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
    const idle=()=>page.waitForFunction(()=>!busy&&(typeof convo==='undefined'||!convo),null,{timeout:30000});
    try{
      await page.goto('http://localhost:8937/');
      await page.waitForTimeout(400);
      await page.click(`#jieGrid .jiebtn[data-k="${birth}"]`);
      await page.waitForTimeout(150);
      const fd={act:pick(FREE),peril:pick(FREE),grow:pick(FREE),boon:pick(FREE)};
      await page.evaluate(([d,f])=>{ crSel.difficulty=d; crSel.fd=f; }, [pick(DIFF),fd]);
      await page.click('#crStart');
      await page.waitForSelector('#choices .opt',{timeout:30000});

      for(let t=0;t<TURNS;t++){
        // 比武弹窗自己打完
        if(await page.$('#duelMask.on')){
          for(let g=0;g<60&&await page.$('#duelMask.on');g++){
            const done=await page.evaluate(()=>{
              const b=document.querySelector('#duelMask button.stance:not([disabled])');
              if(b){ b.click(); return 0; }
              const e=Array.from(document.querySelectorAll('#duelMask button')).find(x=>!x.disabled);
              if(e){ e.click(); return 0; }
              return 1;
            });
            await page.waitForTimeout(200); if(done) break;
          }
          await page.evaluate(()=>document.querySelectorAll('.modal-mask.on').forEach(m=>m.classList.remove('on')));
          await page.waitForTimeout(150);
          continue;
        }
        await page.evaluate(()=>document.querySelectorAll('.modal-mask.on').forEach(m=>m.classList.remove('on')));

        // 四回合换一次界；第八回合起试着下幽墟
        if(t===4||t===8){
          const here=await page.evaluate(()=>{ S.player.money+=8000; S.gateOpen=true; S.gateCloseAt=S.months+2; return jieName(); });
          const to = (t===8&&here==='轮枢') ? '幽墟' : (here==='轮枢' ? pick(BIRTH.filter(x=>x!==birth)) : '轮枢');
          await page.evaluate(k=>crossRealm(k), to);
          await idle(); await page.waitForTimeout(250);
          stat.crosses++; if(to==='幽墟') stat.abyss++;
        }

        if(Math.random()<0.3){
          await page.fill('#freeInput', pick(FREE_ACTS));
          await page.click('#sendBtn');
        }else{
          const o=await page.$('#choices .opt'); if(!o) break;
          await page.evaluate(()=>document.querySelector('#choices .opt').click());
        }
        await idle();
        stat.turns++;

        const snap=await page.evaluate(()=>({
          realm:jieName(),
          txt:Array.from(document.querySelectorAll('#story .ntext')).map(e=>e.textContent).join('\n')
             +'\n'+(document.getElementById('choices')?document.getElementById('choices').textContent:''),
          len:(typeof turnPrompt==='function')?turnPrompt('试',{fate:10,months:1}).length:0,
          over:!!S.over
        }));
        stat.maxPrompt=Math.max(stat.maxPrompt,snap.len);
        const lk=(LEAK[snap.realm]||[]).filter(w=>snap.txt.includes(w));
        if(lk.length) bad.push(`${tag} 第${t+1}回 在${snap.realm}漏了：${lk.join('、')}`);
        if(snap.over) break;
      }
      if(errs.length) bad.push(`${tag} 页面报错：${errs.slice(0,2).join(' | ')}`);
    }catch(e){
      bad.push(`${tag} 跑崩了：${String(e).slice(0,160)}`);
    }
    await ctx.close();
    stat.runs++;
    process.stdout.write(`\r跑了 ${stat.runs}/${BIRTH.length*RUNS} 局，${stat.turns} 回合，换界 ${stat.crosses} 次（下幽墟 ${stat.abyss}），问题 ${bad.length} 条   `);
  }
}
console.log('\n');
console.log(`用时 ${Math.round((Date.now()-t0)/1000)} 秒，提示词最长 ${stat.maxPrompt} 字`);
if(bad.length){ console.log(`\n问题 ${bad.length} 条：`); for(const b of bad.slice(0,40)) console.log('  ✗ '+b); }
else console.log('\n没抓到问题。');
await br.close(); srv.close();
process.exit(bad.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
