// S11 固定人物阿步
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
srv.listen(8965);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
page=await (await br.newContext({viewport:{width:1400,height:900}})).newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
let lastPrompt='';
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData()); const c=b.messages[b.messages.length-1].content; if(c.includes('请推演本回合')) lastPrompt=c;
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(c))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await page.goto('http://localhost:8965/'); await page.waitForTimeout(400);
await page.click('#jieGrid .jiebtn[data-k="樱洲"]'); await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});
const act=async t=>{ await page.fill('#freeInput',t); await page.click('#sendBtn'); await idle(); await page.waitForTimeout(200); await page.evaluate(()=>document.querySelectorAll('.modal-mask.on').forEach(m=>m.classList.remove('on'))); };

const before=await page.evaluate(()=>{
  S.player.hp=40; S.player.attributes['修为']=30;
  S.ailments=[{name:'刀伤',desc:'',months:3}];
  S.scars=[{name:'跛足',text:'走路一瘸',when:'',cause:''}];
  return {m:S.player.money, npcs:S.npcs.length};
});
await act('在河边钓鱼，天快黑了，遇见阿步');
ok('阿步登场：男、修为很高、在当界', await page.evaluate(()=>{ const n=findNpc('阿步'); return !!n&&n.name==='阿步'&&n.gender==='男'&&n['修为']>=95&&n.realm===jieName(); }));
ok('送了一百两（本回合开销另算）', await page.evaluate(m=>S.ledger.some(x=>/遇见阿步，得赠银一百两/.test(x))&&S.player.money>=m+100-20,before.m));
ok('伤全好了，连终身旧伤一起', await page.evaluate(()=>S.player.hp>=95&&!(S.ailments||[]).length&&!(S.scars||[]).length&&!S.player.status.includes('跛足')));
ok('修为大涨', await page.evaluate(()=>S.player.attributes['修为']>=45));
ok('提示词让模型写他出场、祝身体健康万事如意', lastPrompt.includes('阿步出现了')&&lastPrompt.includes('身体健康、万事如意')&&lastPrompt.includes('在河边钓鱼'));
ok('起居注写了赠银、修为、伤愈', await page.evaluate(()=>{ const l=Array.from(document.querySelectorAll('#story .chapter')).pop().textContent; return l.includes('阿步赠银一百两')&&/修为 \+1[5-9]/.test(l)&&l.includes('伤愈：刀伤、跛足'); }));
const again=await page.evaluate(()=>({m:S.player.money,w:S.player.attributes['修为']}));
await page.evaluate(()=>{ S.player.hp=50; });
await act('又去河边，遇见阿步');
ok('第二次只露面，不再送东西', await page.evaluate(a=>S.ledger.filter(x=>/赠银一百两/.test(x)).length===1&&S.player.attributes['修为']<a.w+15&&S.player.hp<100&&S.npcs.filter(n=>n.name==='阿步').length===1,again)&&lastPrompt.includes('这回没再送东西'));
ok('没写「遇见阿步」就不出来', await page.evaluate(()=>!ABU_RE.test('去找阿福')&&ABU_RE.test('路上遇到阿步')));

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
ok('全程无页面报错', errs.length===0);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})();
