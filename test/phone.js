// 手机适配细查：两种窄屏走一遍主要界面，找横向溢出、超宽元素、点不着的按钮
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const {pickBody,sse}=require('./mock');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'));
const srv=http.createServer((q,r)=>{ r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); r.end(html); });
const fails=[],oks=[];
const ok=(n,c,extra)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n+(!c&&extra?'　'+extra:'')); };
const SIZES=[[390,844,'iPhone 常见'],[360,740,'安卓窄屏']];

(async()=>{
srv.listen(8939);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
const ctx=await br.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData());
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
const idle=()=>page.waitForFunction(()=>!busy&&(typeof convo==='undefined'||!convo),null,{timeout:30000});

// 页面上有没有比屏还宽的东西（滚动容器里的表格之类不算）
const wide=()=>page.evaluate(()=>{
  const W=document.documentElement.clientWidth, out=[];
  for(const el of document.querySelectorAll('body *')){
    const cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||!el.offsetParent&&cs.position!=='fixed') continue;
    const r=el.getBoundingClientRect();
    if(r.width<=W+1) continue;
    let p=el.parentElement, scroll=false;
    while(p){ const s=getComputedStyle(p); if(/auto|scroll/.test(s.overflowX)){ scroll=true; break; } p=p.parentElement; }
    if(!scroll) out.push((el.id?'#'+el.id:el.className&&typeof el.className==='string'?'.'+el.className.split(' ')[0]:el.tagName)+` ${Math.round(r.width)}px`);
  }
  return out.slice(0,6);
});
const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
// 点得着吗：iOS 的最小建议是 44，这儿放到 36 当红线
const tiny=()=>page.evaluate(()=>{
  const out=[];
  for(const el of document.querySelectorAll('button, .opt, .wleg, .crossopt, select, input')){
    const cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||!el.offsetParent) continue;
    const r=el.getBoundingClientRect();
    if(r.height>0&&r.height<32) out.push((el.id?'#'+el.id:'.'+String(el.className).split(' ')[0])+` 高${Math.round(r.height)}`);
  }
  return [...new Set(out)].slice(0,6);
});

async function check(name){
  const w=await wide(), of=await overflow(), t=await tiny();
  ok(name+'：不横向滚', !of);
  ok(name+'：没有超宽元素', w.length===0, w.join('，'));
  ok(name+'：按钮点得着', t.length===0, t.join('，'));
}

for(const [W,H,label] of SIZES){
  console.log(`\n【${label} ${W}×${H}】`);
  await page.setViewportSize({width:W,height:H});
  await page.goto('http://localhost:8939/');
  await page.evaluate(()=>{ const c=localStorage.getItem('wanjie_cfg'); localStorage.clear(); localStorage.setItem('wanjie_cfg',c); });
  await page.goto('http://localhost:8939/');
  await page.waitForTimeout(500);
  await check('封面与投胎');
  await page.evaluate(()=>{ const m=document.getElementById('createMask'); if(m&&!m.classList.contains('on')) openCreate(); });
  await page.waitForSelector('#wheelSvg .spoke[data-k="西陆"]',{timeout:15000});
  await page.click(`#wheelSvg .spoke[data-k="西陆"]`);
  await page.waitForTimeout(200);
  await page.evaluate(()=>{ const d=document.getElementById('crFdWrap'); if(d) d.open=true; });
  await page.waitForTimeout(150);
  await check('投胎·细调展开');
  await page.click('#crStart');
  await page.waitForSelector('#choices .opt',{timeout:30000});
  await check('正文与选项');

  for(const [tab,cn] of [['bag','行囊'],['people','人脉'],['world','万界']]){
    await page.evaluate(t=>{ setDrawer(true); document.querySelector(`[data-tab="${t}"]`).click(); }, tab);
    await page.waitForTimeout(250);
    await check('抽屉·'+cn);
  }
  await page.evaluate(()=>setDrawer(false));
  await page.waitForTimeout(200);

  await page.evaluate(()=>{ S.player.money+=8000; S.gateOpen=true; S.gateCloseAt=S.months+2; openCross(); });
  await page.waitForTimeout(250);
  await check('过界弹窗');
  await page.evaluate(()=>$('crossMask').classList.remove('on'));

  await page.evaluate(()=>openSettings());
  await page.waitForTimeout(250);
  await check('设置·四组细调');
  await page.evaluate(()=>$('settingsMask').classList.remove('on'));

  const foe=await page.evaluate(()=>{ const n=(S.npcs||[]).find(x=>x.alive); return n?n.name:null; });
  if(foe){
    await page.evaluate(n=>{ const x=findNpc(n); startDuel(x,{lethal:false,reason:'试',action:'试',judge:{fate:10,check:null,worldEvent:null,months:1}}); }, foe);
    await page.waitForTimeout(400);
    await check('比武');
    await page.evaluate(()=>document.querySelectorAll('.modal-mask.on').forEach(m=>m.classList.remove('on')));
  }
}

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(errs.length) console.log('页面报错：\n'+errs.slice(0,4).join('\n'));
await page.setViewportSize({width:390,height:844});
await page.goto('http://localhost:8939/'); await page.waitForTimeout(400);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
