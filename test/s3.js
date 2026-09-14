// S3 搬家自测：对着规范 v0.8 的 F2/F3/F4/G1/G2/B2 逐条过
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
srv.listen(8934);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
const ctx=await br.newContext({viewport:{width:1400,height:900}});
page=await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
// 连通性自测故意打了几个 401/402/404，浏览器会在控制台叫，不算页面报错
page.on('console',m=>{ if(m.type()==='error'&&!/Failed to load resource/.test(m.text())) errs.push('console:'+m.text()); });
const hits=[];
await page.route('**/chat/completions',async route=>{
  const u=route.request().url();
  const b=JSON.parse(route.request().postData());
  const auth=route.request().headers()['authorization']||'';
  hits.push(u);
  // 连通性自测发的是短请求（max_tokens 64），拿它来演各种错
  if(b.max_tokens===64){
    if(/sk-bad/.test(auth)) return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:{message:'Invalid API key'}})});
    if(/sk-poor/.test(auth)) return route.fulfill({status:402,contentType:'application/json',body:JSON.stringify({error:{message:'Insufficient balance'}})});
    if(/sk-404/.test(auth)) return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:{message:'Model not found'}})});
    // 这把 key 专演「地址少写了 /v1」：不带 /v1 的就 404，带了才通
    if(/sk-needv1/.test(auth)&&!/\/v1\/chat\/completions$/.test(u))
      return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:{message:'Not Found'}})});
    return route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse({ok:1})});
  }
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))});
});

console.log('\n【F2 不接模型不让玩】');
await page.goto('http://localhost:8934/');   // 没 key
await page.waitForTimeout(400);
ok('没 key 时直接把设置摆出来', await page.evaluate(()=>$('settingsMask').classList.contains('on')));
ok('设置副标题写明没 key 开不了局', (await page.textContent('#settingsMask .sub')).includes('开不了局'));
await page.click('#cfgCancel'); await page.waitForTimeout(150);
ok('没 key 时「关闭」关不掉', await page.evaluate(()=>$('settingsMask').classList.contains('on')));
await page.evaluate(()=>$('settingsMask').click());
ok('没 key 时点背景也关不掉', await page.evaluate(()=>$('settingsMask').classList.contains('on')));
await page.keyboard.press('Escape'); await page.waitForTimeout(150);
ok('没 key 时按 Esc 也关不掉', await page.evaluate(()=>$('settingsMask').classList.contains('on')));
await page.click('#cfgSave'); await page.waitForTimeout(150);
ok('key 空着存不下，且说人话', (await page.textContent('#cfgTestMsg')).includes('开不了局'));
ok('没 key 时进不了投胎', await page.evaluate(()=>{ openCreate(); return !$('createMask').classList.contains('on'); }));

console.log('\n【F3 连通性自测】');
await page.fill('#cfgBase','https://api.example.com');
const type=async(k)=>{ await page.fill('#cfgKey',k); await page.click('#cfgTest'); await page.waitForFunction(()=>!$('cfgTest').disabled,null,{timeout:15000}); return page.textContent('#cfgTestMsg'); };
ok('401 说 key 不对', (await type('sk-bad')).includes('key 不对'));
ok('402 说没余额', (await type('sk-poor')).includes('没余额'));
ok('404 说模型名或地址不对', (await type('sk-404')).includes('模型名或接口地址不对'));
const good=await type('sk-test');
ok('通了会报模型名、回的字和耗时：'+good.slice(0,40), good.includes('通了')&&good.includes('毫秒'));
// 「能推演剧情，自测却不通」就是这儿出的岔子：两处拼地址的算法必须是同一个
ok('自测和正式调用拼的是同一个地址', await page.evaluate(()=>apiUrl('https://api.example.com/')==='https://api.example.com/chat/completions'));
ok('自测没有多接一层 /v1', hits.length>0&&hits[hits.length-1]==='https://api.example.com/chat/completions');
ok('自测发的请求跟正式推演同一种（流式 + json_object）', await page.evaluate(()=>{
  const b=apiBody('deepseek-v4-flash',[{role:'user',content:'x'}],64);
  return b.stream===true&&b.response_format&&b.response_format.type==='json_object'&&!!b.thinking;
}));
const needv1=await type('sk-needv1');
ok('地址少写 /v1 时会自己补上再试，并告诉你该怎么改：'+needv1.slice(-46),
   needv1.includes('通了')&&needv1.includes('https://api.example.com/v1'));
ok('补 /v1 那次真的打到了带 /v1 的地址', hits[hits.length-1]==='https://api.example.com/v1/chat/completions');
await page.fill('#cfgBase','https://api.example.com');
await page.click('#cfgSave'); await page.waitForTimeout(300);
ok('存下之后设置关掉了', !(await page.evaluate(()=>$('settingsMask').classList.contains('on'))));
ok('存下之后直接弹投胎', await page.evaluate(()=>$('createMask').classList.contains('on')));

console.log('\n【开一局】');
await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});

console.log('\n【B2 目标卡】');
ok('目标卡挂在正文顶上', await page.evaluate(()=>{
  const g=$('goalCard'), st=$('story');
  return g.classList.contains('on') && g.parentElement===$('main')
      && g.getBoundingClientRect().bottom<=st.getBoundingClientRect().top+1;
}));
ok('卡上是宿命名 · 进度', (await page.textContent('#goalCard')).includes('查明父亲死因')&&/%/.test(await page.textContent('#goalCard')));
ok('取的是第一条「进行中」', await page.evaluate(()=>goalPick().status==='进行中'));
await page.click('#goalCard'); await page.waitForTimeout(200);
ok('点开列出全部宿命', await page.evaluate(()=>$('goalMask').classList.contains('on')) && (await page.$$('#goalList .quest')).length>=1);
await page.keyboard.press('Escape'); await page.waitForTimeout(150);
ok('Esc 能合上', !(await page.evaluate(()=>$('goalMask').classList.contains('on'))));
const p0=await page.textContent('#goalCard');
await page.click('#choices .opt'); await idle(); await page.waitForTimeout(200);
ok('进度会跟着剧情走：'+p0.replace(/\s+/g,'')+' → '+(await page.textContent('#goalCard')).replace(/\s+/g,''),
   (await page.textContent('#goalCard'))!==p0);

console.log('\n【F4 字数标准】');
const tp=await page.evaluate(()=>turnPrompt('试试看',{fate:10,months:1}));
ok('每月记事 700-1000 字三到五段', tp.includes('700-1000字')&&tp.includes('三到五段'));
ok('规定了字往哪儿花', tp.includes('至少两处有人开口说话')&&tp.includes('独处时的盘算'));
const ip=await page.evaluate(()=>initSchemaPrompt({}));
ok('开场 600-850 字三到四段', ip.includes('600-850字')&&ip.includes('三到四段'));
ok('身世 300-420 字', ip.includes('300-420字'));
await page.evaluate(()=>openConvo(S.npcs[0])); await page.waitForTimeout(200);
const cp=await page.evaluate(()=>convoPrompt(S.npcs[0],'你好',10,null));
await page.evaluate(()=>endConvo()); await page.waitForTimeout(200);
ok('面谈回话两到四句', cp.includes('两到四句'));

console.log('\n【G1 说话挑出来】');
ok('三种引号都包成 q', await page.evaluate(()=>{
  const h=narrativeHtml('他说「走吧」，又说“等等”，再说"就这样"');
  return (h.match(/<q>/g)||[]).length===3;
}));
ok('落单的引号不会把整段吞掉', await page.evaluate(()=>narrativeHtml('他说「走吧，然后就没有然后了').indexOf('<q>')<0));
ok('标点那条在世界铁律里', (await page.evaluate(()=>lawBlock())).includes('不许把说话和旁白混在同一句里'));

console.log('\n【G2 自由输入挑属性】');
ok('动手的挑修为', await page.evaluate(()=>guessAttr('去跟他打一架')==='修为'));
ok('打听的挑谈吐', await page.evaluate(()=>guessAttr('去酒馆打听消息')==='谈吐'));
ok('查书的挑学识', await page.evaluate(()=>guessAttr('翻阅典籍查一查旧案')==='学识'));
ok('参悟的挑悟性', await page.evaluate(()=>guessAttr('闭目参悟那句口诀')==='悟性'));
ok('挑不出来就不挑', await page.evaluate(()=>guessAttr('随便走走')===null));
ok('挑好的属性写进了判定块', await page.evaluate(()=>judgeBlock({fate:10,months:1,freeAttr:'谈吐'}).includes('引擎已经挑好：【谈吐】')));
await page.fill('#freeInput','去酒馆打听消息'); await page.click('#sendBtn'); await idle(); await page.waitForTimeout(200);
ok('自由输入走一遍不报错', errs.length===0||console.log('    '+errs.slice(0,2).join(' | ')));

console.log('\n【G3 掷20必成、掷1必败】');
ok('掷 20 必成', await page.evaluate(()=>{ const d=Math.random; let n=0; Math.random=()=>{n++;return 0.999;}; const r=rollCheck('学识',100); Math.random=d; return r.success===true; }));
ok('掷 1 必败', await page.evaluate(()=>{ const d=Math.random; Math.random=()=>0; const r=rollCheck('学识',1); Math.random=d; return r.success===false; }));

console.log('\n【v1.2 外观年龄与文风】');
ok('外观年龄 = 实岁 ÷ 寿元 × 78', await page.evaluate(()=>{
  const p=S.player, a0=p.age, l0=p.lifespan;
  p.age=120; p.lifespan=200; const look=lookAge(p);
  p.age=a0; p.lifespan=l0;
  return look===47;
}));
ok('提示词按外观年龄写，不按实岁', await page.evaluate(()=>{
  const p=S.player, a0=p.age, l0=p.lifespan;
  p.age=120; p.lifespan=200;
  const t=stateBlocks();
  p.age=a0; p.lifespan=l0;
  return t.includes('看着约47岁')&&t.includes('不要按实岁');
}));
ok('头像也按外观年龄落桶', await page.evaluate(()=>{
  const a=avBucket('男',210,'东荒');
  const b=avBucket('男',lookAge({age:210,lifespan:300}),'东荒');
  return a.join()!==b.join()&&lookAge({age:210,lifespan:300})===55;
}));
ok('明说了要留下就不硬推转场', await page.evaluate(()=>{
  S.nudgeSeq=0; S.turn=0;
  const stay=pickNudge('我就留在这儿，接着练');
  S.nudgeSeq=0; S.turn=0;
  const go=pickNudge('随便走走');
  return !stay.includes('换个地方') && go.includes('换个地方');
}));
ok('选项规则不再禁止重复练功，只要求内容有变化', await page.evaluate(()=>
  OPTIONS_RULE.includes('同一件事可以接连做')&&!OPTIONS_RULE.includes('就别再给「继续练功」')));

console.log('\n【自由度拆四组】');
ok('四组默认跟预设一档，数值与从前一模一样', await page.evaluate(()=>{
  fdSetAll('mid');
  const f=fdm(), m=FREEDOM.mid;
  return f.label===m.label && f.wcap===m.wcap && f.injury===m.injury && f.money===m.money && f.freeAct===m.freeAct;
}));
ok('只调一组，别的组一动不动', await page.evaluate(()=>{
  fdSetAll('mid');
  fdSet('grow','free');
  const f=fdm();
  return f.wcap===FREEDOM.free.wcap && f.lifeCap===FREEDOM.free.lifeCap      // 成长尺度跟着松了
      && f.injury===FREEDOM.mid.injury && f.kill===FREEDOM.mid.kill          // 凶险没动
      && f.freeAct===FREEDOM.mid.freeAct && f.money===FREEDOM.mid.money;     // 行动与厚道也没动
}));
ok('行动自由度单独拉满：言出法随，但世道照旧凶险', await page.evaluate(()=>{
  fdSetAll('strict'); fdSet('act','free');
  const f=fdm();
  return f.freeAct===true && f.tone===FREEDOM.free.tone
      && f.kill===FREEDOM.strict.kill && f.wcap===FREEDOM.strict.wcap;
}));
ok('四组不一致时标成「自定」', await page.evaluate(()=>{
  fdSetAll('mid'); const a=fdm().label;
  fdSet('peril','strict'); const b=fdm().label;
  fdSetAll('mid');
  return a==='万界传奇'&&b==='自定';
}));
ok('老存档升到 v11：那个单值原样摊到四组', await page.evaluate(()=>{
  const s={v:10,realm:'东荒',homeRealm:'东荒',months:0,npcs:[],freedom:'strict',player:{items:{}}};
  migrate(s);
  return s.v>=11&&s.fd_act==='strict'&&s.fd_peril==='strict'&&s.fd_grow==='strict'&&s.fd_boon==='strict';
}));

console.log('\n【手机 390×844】');
await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(300);
ok('无横向溢出', !(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1)));
ok('目标卡在手机上也在', await page.evaluate(()=>{const r=$('goalCard').getBoundingClientRect();return r.width>100&&r.height>0;}));
await page.screenshot({path:path.join(__dirname,'s3-phone.png')});
await page.setViewportSize({width:1400,height:900}); await page.waitForTimeout(200);
await page.screenshot({path:path.join(__dirname,'s3-desk.png')});

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
await br.close(); srv.close();
process.exit(fails.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
