// S1 换皮自测：假接口跑通东荒一局，核对三层断言、界数据、跨界泄漏、墨影、手机布局
// 用法：node test/s1.js（需 playwright；容器里用 PW_CHROME 指定 chromium）
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const {pickBody,sse,serve}=require('./mock');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'));
const srv=http.createServer(serve);
const fails=[],oks=[];
const ok=(n,c)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n); };
let page;
const idle=()=>page.waitForFunction(()=>!busy&&(typeof convo==='undefined'||!convo),null,{timeout:25000});
// 别界的词：东荒局里出现即算泄漏
const LEAK=['魔法','魔力','魔导','斗气','骑士','教廷','大魔导','咒力','式神','阴阳师','忍者','冒险者公会','殿下','陛下','阁下'];

(async()=>{
srv.listen(8932);
const exe=process.env.PW_CHROME||undefined;
const br=await chromium.launch(exe?{executablePath:exe}:{});
const ctx=await br.newContext({viewport:{width:1400,height:900}});
page=await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
page.on('console',m=>{ if(m.type()==='error') errs.push('console:'+m.text()); });
let lastPrompt='',msgs=[];
await page.route('**/chat/completions',async route=>{
  const body=JSON.parse(route.request().postData());
  lastPrompt=body.messages[body.messages.length-1].content; msgs=body.messages;
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(lastPrompt))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'deepseek-v4-flash',think:false})); });
await page.goto('http://localhost:8932/');

console.log('\n【转轮】');
ok('五个界都列出来了', (await page.$$('#jieGrid .jiebtn')).length===5);
ok('能投胎的三个，轮枢幽墟锁着', (await page.$$('#jieGrid .jiebtn:not(.off)')).length===3);
ok('默认选中东荒', (await page.textContent('#jieGrid .jiebtn.sel')).includes('东荒'));
ok('锁着的两个写明了为什么', (await page.textContent('#jieGrid')).includes('只能去'));
await page.click('#jieGrid .jiebtn[data-k="西陆"]'); await page.waitForTimeout(200);
ok('点了西陆就换过去', (await page.textContent('#jieGrid .jiebtn.sel')).includes('西陆'));
ok('底下的界景跟着换', await page.evaluate(()=>{
  const el=document.getElementById('jieShot');
  return el.classList.contains('on') && el.style.backgroundImage.indexOf('data:image')>0;
}));
ok('点锁着的界不生效', await page.evaluate(async()=>{
  document.querySelector('#jieGrid .jiebtn[data-k="幽墟"]').click();
  return crSel.realm==='西陆';
}));
await page.click('#jieGrid .jiebtn[data-k="东荒"]'); await page.waitForTimeout(200);
ok('点回东荒', (await page.textContent('#jieGrid .jiebtn.sel')).includes('东荒'));
ok('轮子那一套彻底没了', await page.evaluate(()=>
  !document.getElementById('wheelSvg') && !document.getElementById('crSpin')
  && typeof WHEEL_IMG==='undefined' && typeof spinWheel==='undefined'));
const bgn=(await page.$$('#bgGrid .bgopt')).length;
ok('出身背景是东荒的一套（'+bgn+'项）', bgn>=16 && (await page.textContent('#bgGrid')).includes('修真世家'));

await page.screenshot({path:path.join(__dirname,'s1-jiepick.png')});
await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});

console.log('\n【三层断言】');
ok('system 用的是按界取的文风范例', msgs.length===2 && msgs[0].content.includes('东荒') && msgs[0].content.includes('云台观'));
const init=await page.evaluate(()=>initSchemaPrompt({}));
ok('第一层【世界铁律】在最前', init.indexOf('【世界铁律】')>=0 && init.indexOf('【世界铁律】')<init.indexOf('【当界名录】'));
ok('第二层【当界名录】在机制通则之前', init.indexOf('【当界名录】')<init.indexOf('【机制通则】'));
ok('第三层【本局自由度】在机制通则之后', init.indexOf('【机制通则】')<init.indexOf('【本局自由度'));
ok('尾注按五层优先级写', init.includes('有没有')&&init.includes('发生过没有')&&init.includes('算不算成')
   &&init.indexOf('有没有')<init.indexOf('发生过没有')&&init.indexOf('发生过没有')<init.indexOf('算不算成'));
ok('机制通则开头是四步执行顺序', /【机制通则】\n每回合按这四步走/.test(init)&&init.includes('先有结果，再有故事'));
const jb=await page.evaluate(()=>jieBlock());
ok('【当界名录】只写当界（不带别界的名录）', !jb.includes('魔法塔') && !jb.includes('幕府') && !jb.includes('忍村'));
ok('名录含东荒境界表', init.includes('炼气 → 筑基 → 金丹'));
ok('名录含东荒称呼表', init.includes('道友'));
ok('风闻改成本界+轮枢两条', init.includes('轮枢传来的异界风闻'));
ok('万界榜跨界条款在', init.includes('要经轮枢过去找'));

console.log('\n【引擎】');
ok('存档记下了界', await page.evaluate(()=>S.realm==='东荒'));
ok('NPC 带界字段', await page.evaluate(()=>S.npcs.every(n=>n.realm==='东荒')));
ok('修为按东荒境界显示', (await page.textContent('#pAttrs')).includes('金丹')||(await page.textContent('#pAttrs')).includes('筑基')||(await page.textContent('#pAttrs')).includes('元婴'));
ok('势力位阶按宗门翻（外门弟子）', (await page.textContent('#pSect')).includes('弟子'));
ok('有画像就用画像，没画像才退回墨影', await page.evaluate(()=>{
  // 原来这条写的是 .includes('svg')——图集的 base64 里碰巧有 "svg" 三个字母，
  // 所以一直是蒙对的。改成按 avCellStyle 有没有命中来判。
  const bi=document.querySelector('#pFace .avatar').style.backgroundImage||'';
  return avCellStyle(avSlotOf(S.player)) ? bi.indexOf('image/webp')>0 : bi.indexOf('image/svg')>0;
}));
ok('功法词卫会换掉别界的词', await page.evaluate(()=>normArt({name:'魔法飞弹诀',desc:'以魔力为引',style:'绝学',level:20}).name==='法术飞弹诀'));

console.log('\n【跑几个回合】');
for(let i=0;i<3;i++){
  await page.click('#choices .opt'); await idle(); await page.waitForTimeout(200);
}
ok('三回合无页面报错', errs.length===0 || console.log('    '+errs.slice(0,3).join(' | ')));
// 只查正文与选项：轮枢传来的异界风闻本来就该点名别界，不算泄漏
const body=await page.evaluate(()=>Array.from(document.querySelectorAll('#story .ntext')).map(e=>e.textContent).join('\n'));
const optTxt=await page.textContent('#choices');
const leaked=LEAK.filter(w=>body.includes(w)||optTxt.includes(w));
ok('正文与选项无跨界泄漏'+(leaked.length?'（发现：'+leaked.join('、')+'）':''), leaked.length===0);

console.log('\n【手机 390×844】');
await page.setViewportSize({width:390,height:844});
await page.waitForTimeout(300);
const ovf=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
ok('无横向溢出', !ovf);
await page.screenshot({path:path.join(__dirname,'s1-phone.png'),fullPage:false});
await page.setViewportSize({width:1400,height:900});
await page.screenshot({path:path.join(__dirname,'s1-desk.png')});

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
await br.close(); srv.close();
process.exit(fails.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
