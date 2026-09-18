// S10 按日推演
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const {pickBody,sse,serve}=require('./mock');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'));
const srv=http.createServer(serve);
const fails=[],oks=[];
const ok=(n,c)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n); };
let page;
const idle=()=>page.waitForFunction(()=>!busy&&(typeof convo==='undefined'||!convo),null,{timeout:25000});

(async()=>{
srv.listen(8964);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
page=await (await br.newContext({viewport:{width:1400,height:900}})).newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
let lastPrompt='';
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData()); const c=b.messages[b.messages.length-1].content; if(c.includes('请推演本回合')) lastPrompt=c;
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(c))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await page.goto('http://localhost:8964/'); await page.waitForTimeout(400);
await page.click('#jieGrid .jiebtn[data-k="东荒"]'); await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});

console.log('\n【日子】');
ok('开局是初一，日期里带日', await page.evaluate(()=>S.day===0&&/初一$/.test(S.date)));
ok('西陆写「几日」', await page.evaluate(()=>{ const r=S.realm; S.realm='西陆'; const t=dateStr(); S.realm=r; return / 1日$/.test(t); }));
ok('选项默认三天，老选项的月折成天', await page.evaluate(()=>optDays({})===3&&optDays({months:2})===60&&optDays({days:5})===5&&optDays({type:'rest'})===7));
ok('几天的回合不走月结，钱不扣、月份不动', await page.evaluate(()=>{
  const m=S.months, $0=S.player.money, d=S.day;
  const up=advanceDays(5);
  return S.months===m&&S.day===d+5&&S.player.money===$0&&up.months===0;
}));
ok('攒满三十天走一次月结', await page.evaluate(()=>{
  const m=S.months, $0=S.player.money; S.day=27;
  const up=advanceDays(5);
  return S.months===m+1&&S.day===2&&up.cost>0&&up.months===1;
}));
ok('伤病按天数折算着好', await page.evaluate(()=>{
  S.ailments=[{name:'擦伤',desc:'',months:0.2}]; S.player.hp=50;
  advanceDays(3); const still=S.ailments.length===1;
  advanceDays(4); return still&&S.ailments.length===0;
}));
ok('几天的回合修为多半不涨，至多 1', await page.evaluate(()=>{
  let tot=0, max=0;
  for(let i=0;i<40;i++){
    const w=S.player.attributes['修为'];
    applyTurn({narrative:'x',summary:'x',playerChanges:{attributes:{'修为':3}}},'练功',{fate:10,days:2});
    const g=S.player.attributes['修为']-w; tot+=g; max=Math.max(max,g);
  }
  return max<=1&&tot<25;
}));
ok('闭关一个月照旧能长几点', await page.evaluate(()=>{
  const w=S.player.attributes['修为'];
  applyTurn({narrative:'x',summary:'x',playerChanges:{attributes:{'修为':3}}},'闭关',{fate:10,days:30});
  return S.player.attributes['修为']-w>=1;
}));
ok('起居注写「过去 N 天」', await page.evaluate(()=>{ applyTurn({narrative:'x',summary:'x'},'走走',{fate:10,days:4}); return changeLines({}).includes('光阴 过去 4 天'); }));
ok('老存档的 months 判定照样认', await page.evaluate(()=>judgeDays({months:2})===60&&judgeDays({months:0})===0));

console.log('\n【提示词】');
await page.evaluate(()=>{ S.lastOptions=[{text:'去镇上转一圈',type:'normal',days:2}]; renderOptions(S.lastOptions); });
await page.evaluate(()=>document.querySelector('#choices .opt').click()); await idle();
ok('提示词写历时几天，叮嘱别跳月', lastPrompt.includes('本回合历时：2 天')&&lastPrompt.includes('不要写「数月后」'));
ok('选项格式要 days，大多数在 10 天以内', lastPrompt.includes('"days":耗时天数')&&lastPrompt.includes('绝大多数选项应在10天以内'));
ok('短选项不挂耗时标签，长的挂', await page.evaluate(()=>{ renderOptions([{text:'a',days:2},{text:'b',days:45}]); const t=$('choices').textContent; return !t.includes('耗时 2')&&t.includes('耗时 1 个月零 15 天'); }));
ok('存档升到最新，补上 day', await page.evaluate(()=>{ const s=JSON.parse(JSON.stringify(S)); s.v=18; delete s.day; s.lastOptions=[{text:'x',months:2}]; migrate(s); return s.v===SAVE_VERSION&&s.day===0&&s.lastOptions[0].days===60; }));

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
ok('全程无页面报错', errs.length===0);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})();
