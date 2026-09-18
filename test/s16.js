// S16 离线缓存、装到桌面、首屏（规范 v3.4）
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path'),zlib=require('zlib');
const {pickBody,sse,serve}=require('./mock');
const srv=http.createServer(serve);
const fails=[],oks=[];
const ok=(n,c)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n); };

(async()=>{
srv.listen(8972);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});

console.log('\n【体积】');
const raw=fs.readFileSync(path.join(__dirname,'..','index.html'));
const gz=zlib.gzipSync(raw,{level:6});
console.log('  index.html 原始 '+(raw.length/1048576).toFixed(2)+' MB，gzip 后 '+(gz.length/1048576).toFixed(2)+' MB');
ok('首屏传输在 1.8 MB 以内（v3.3 是 2.32 MB）', gz.length<1.8*1048576);
ok('图标与 manifest 是真文件，不再内嵌', fs.existsSync(path.join(__dirname,'..','site.webmanifest'))
  &&fs.existsSync(path.join(__dirname,'..','icon','icon-192.png'))
  &&fs.existsSync(path.join(__dirname,'..','icon','icon-512.png'))
  &&fs.existsSync(path.join(__dirname,'..','sw.js')));
const mf=JSON.parse(fs.readFileSync(path.join(__dirname,'..','site.webmanifest'),'utf8'));
ok('manifest 该有的都有（少一样 Chrome 就不让装）',
  mf.name&&mf.start_url==='.'&&mf.scope==='.'&&mf.display==='standalone'
  &&mf.icons.some(i=>i.sizes==='192x192')&&mf.icons.some(i=>i.sizes==='512x512')
  &&mf.icons.some(i=>i.purpose==='maskable'));
ok('全用相对路径（Pages 挂在子目录下，绝对路径会 404）',
  !/"(src|start_url|scope)":\s*"\//.test(fs.readFileSync(path.join(__dirname,'..','site.webmanifest'),'utf8'))
  &&!/href="\/(icon|favicon|site\.)/.test(raw.toString('utf8').slice(0,4000)));

console.log('\n【开场那块石板】');
{
  const ctx=await br.newContext({viewport:{width:390,height:844}});
  const page=await ctx.newPage();
  const cdp=await ctx.newCDPSession(page); await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:1500*1000/8,uploadThroughput:1e6});
  const nav=page.goto('http://localhost:8972/',{waitUntil:'load'});
  await page.waitForTimeout(700);
  const early=await page.evaluate(()=>{const b=document.getElementById('boot');
    return b?{on:getComputedStyle(b).opacity>0.5, title:b.querySelector('.btitle').textContent, w:(document.getElementById('bootFill').style.width||'0')}:null;}).catch(()=>null);
  ok('页面还在下的时候石板就已经在了', !!early&&early.on&&early.title==='命运之轮');
  const marks=[];
  for(let i=0;i<14;i++){
    await page.waitForTimeout(400);
    const w=await page.evaluate(()=>{const f=document.getElementById('bootFill');return f?(f.style.width||'0'):'gone';}).catch(()=>'gone');
    marks.push(w); if(w==='gone') break;
  }
  const nums=marks.filter(x=>x!=='gone'&&x!=='0').map(x=>parseInt(x));
  ok('进度条真的随字节流往前走（量到 '+(nums.join('→')||'无')+'）', nums.length>=2&&nums[nums.length-1]>nums[0]);
  await nav.catch(()=>{});
  await page.waitForTimeout(600);
  ok('跑起来之后石板撤掉', await page.evaluate(()=>!document.getElementById('boot')||document.getElementById('boot').classList.contains('gone')));
  await ctx.close();
}

console.log('\n【离线】');
{
  const ctx=await br.newContext({viewport:{width:1400,height:900}});
  const page=await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  page.on('console',m=>{ if(m.type()==='error') errs.push('console:'+m.text()); });
  await page.route('**/chat/completions',async r=>{ const b=JSON.parse(r.request().postData());
    await r.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))}); });
  await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
  await page.goto('http://localhost:8972/',{waitUntil:'load'});
  await page.waitForFunction(()=>navigator.serviceWorker&&navigator.serviceWorker.controller,null,{timeout:15000}).catch(()=>{});
  const st=await page.evaluate(async()=>({reg:!!await navigator.serviceWorker.getRegistration(),
    ctrl:!!navigator.serviceWorker.controller, keys:await caches.keys()}));
  ok('service worker 装上并接管了', st.reg&&st.ctrl&&st.keys.length>0);
  const cached=await page.evaluate(async()=>{ const c=await caches.open((await caches.keys())[0]);
    const k=await c.keys(); return k.map(x=>new URL(x.url).pathname); });
  ok('整页与图标都进了缓存', cached.some(x=>x==='/'||x.endsWith('index.html'))&&cached.some(x=>x.indexOf('icon-192')>0));
  ok('头一回装不会自己刷新页面', errs.filter(e=>/Execution context/.test(e)).length===0);

  await ctx.setOffline(true);
  await page.reload({waitUntil:'load'});
  await page.waitForTimeout(600);
  ok('拔了网线还打得开', await page.evaluate(()=>!!document.getElementById('jieGrid')||!!document.getElementById('story')));
  ok('离线时没报错', errs.filter(e=>!/Failed to fetch|net::ERR/.test(e)).length===0
     ||console.log('    '+errs.slice(0,3).join(' | ')));
  await ctx.setOffline(false);
  await ctx.close();
}

console.log('\n【装到桌面】');
{
  const ctx=await br.newContext({viewport:{width:1400,height:900}});
  const page=await ctx.newPage();
  await page.addInitScript(()=>{
    localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false}));
    // headless 不会自己发 beforeinstallprompt，自己造一个
    setTimeout(()=>{ const e=new Event('beforeinstallprompt');
      e.prompt=()=>{ window.__prompted=true; }; e.userChoice=Promise.resolve({outcome:'accepted'});
      dispatchEvent(e); },400);
  });
  await page.route('**/chat/completions',async r=>{ const b=JSON.parse(r.request().postData());
    await r.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))}); });
  await page.goto('http://localhost:8972/',{waitUntil:'load'});
  await page.waitForTimeout(900);
  ok('设置里有常驻入口', await page.evaluate(()=>!!document.getElementById('cfgInstall')));
  await page.evaluate(()=>openPwa(true));
  await page.waitForTimeout(200);
  ok('弹窗出来了，且给的是一键装', await page.evaluate(()=>
    document.getElementById('pwaMask').classList.contains('on')
    && document.getElementById('pwaGo').style.display!=='none'
    && document.getElementById('pwaGuide').textContent.includes('装上')));
  await page.click('#pwaGo'); await page.waitForTimeout(300);
  ok('点装上真的把浏览器那一问调起来了', await page.evaluate(()=>window.__prompted===true
    && localStorage.getItem('wanjie_pwa')==='installed'));
  await page.evaluate(()=>{ localStorage.setItem('wanjie_pwa','dismissed'); });
  ok('点过以后再说就不再自己弹', await page.evaluate(()=>{ pwaArmed=false; pwaPrompt={}; armPwa(); return pwaArmed===false; }));
  await ctx.close();
}
{ // iPhone 上给的是图文指引，不是一键
  const ctx=await br.newContext({viewport:{width:390,height:844},
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
  const page=await ctx.newPage();
  await page.goto('http://localhost:8972/',{waitUntil:'load'});
  await page.waitForTimeout(500);
  await page.evaluate(()=>openPwa(true));
  ok('iPhone 上给的是「分享 → 添加到主屏幕」的具体路径', await page.evaluate(()=>{
    const t=document.getElementById('pwaGuide').textContent;
    return t.includes('分享')&&t.includes('添加到主屏幕')&&document.getElementById('pwaGo').style.display==='none'; }));
  await ctx.close();
}

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
await br.close(); srv.close();
process.exit(fails.length?1:0);
})();
