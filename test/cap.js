// 抓包看缓存：开局加 8 回合，抓下每次发给模型的完整请求，算相邻两回合从头开始相同的字数占比。
// 以后改提示词，先跑它看命中率掉没掉（规范 v4.5 第六节）。
// 用法：node test/cap.js            （只看统计）
//       OUT=xx.json node test/cap.js  （另把请求原文存下来，逐段比对用）
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs');
const {pickBody,sse,serve}=require('./mock');
const srv=http.createServer(serve);
(async()=>{
srv.listen(8961);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
const page=await (await br.newContext({viewport:{width:1400,height:900}})).newPage();
page.on('pageerror',e=>console.log('页面报错',String(e)));
const reqs=[];
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData());
  const p=b.messages[b.messages.length-1].content;
  reqs.push({sys:b.messages.length>1?b.messages[0].content:'',user:p});
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(p))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await page.goto('http://localhost:8961/'); await page.waitForTimeout(400);
await page.click('#jieGrid .jiebtn[data-k="东荒"]'); await page.waitForTimeout(150);
await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});
const idle=()=>page.waitForFunction(()=>!busy,null,{timeout:25000});
const acts=['在观里练功','去镇上打听消息','找沈师姐说话','去后山砍柴','在观里练功','读书','去镇上买药','继续练功'];
for(const a of acts){ await idle(); await page.evaluate(a=>act(a,{type:'normal',days:3}),a); await page.waitForTimeout(300); await idle(); }
if(process.env.OUT) fs.writeFileSync(process.env.OUT,JSON.stringify(reqs));
const turns=reqs.filter(r=>r.user.includes('请推演本回合')).map(r=>r.sys+'\n'+r.user);
const cp=(a,b)=>{ let i=0; while(i<a.length&&i<b.length&&a[i]===b[i]) i++; return i; };
let hit=0,tot=0;
for(let i=1;i<turns.length;i++){
  const c=cp(turns[i-1],turns[i]); hit+=c; tot+=turns[i].length;
  console.log(`第${i+1}回合 ${turns[i].length} 字，开头相同 ${c} 字（${(c/turns[i].length*100).toFixed(1)}%），从这里分岔：${JSON.stringify(turns[i].slice(c,c+24))}`);
}
console.log(`\n平均命中 ${(hit/tot*100).toFixed(1)}%`);
await br.close(); srv.close();
})();
