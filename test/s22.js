// S22 括号里的推演要求（规范 v3.8）：言出法随那一档，行动后面括号里的要求单独列出、逐条照办；另两档一个字不改
// 用法：node test/s22.js（需 playwright；容器里用 PW_CHROME 指定 chromium）
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const {pickBody,sse,serve}=require('./mock');
const srv=http.createServer(serve);
const fails=[],oks=[];
const ok=(n,c)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n); };
const OLD='/归档/index_v3.7_括号前.html';
const hasOld=fs.existsSync(path.join(__dirname,'..',OLD));

async function open(br,url){
  const page=await (await br.newContext({viewport:{width:1400,height:900}})).newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  await page.route('**/chat/completions',async route=>{
    const b=JSON.parse(route.request().postData());
    page._sent=(page._sent||[]).concat([b.messages.map(m=>m.content).join('\n')]);
    await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))});
  });
  await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
  await page.goto('http://localhost:8982'+url); await page.waitForTimeout(400);
  await page.click('#jieGrid .jiebtn[data-k="东荒"]'); await page.click('#crStart');
  await page.waitForSelector('#choices .opt',{timeout:25000});
  page._errs=errs; return page;
}

(async()=>{
srv.listen(8982);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
const page=await open(br,'/');
const ev=(f,a)=>(a===undefined?page.evaluate(f):page.evaluate(f,a));

console.log('【splitAsk】');
const cases=[
  ['我走进酒馆（写得慢一点）', '我走进酒馆', ['写得慢一点']],
  ['我走进酒馆(写得慢一点)', '我走进酒馆', ['写得慢一点']],
  ['（拍拍他的肩）你先别急（讲细一点）', '你先别急', ['拍拍他的肩','讲细一点']],
  ['我拔剑（写他的表情（尤其眼神）要细）', '我拔剑', ['写他的表情（尤其眼神）要细']],
  ['我去酒馆', '我去酒馆', []],
  ['（这回合只写心理活动）', '', ['这回合只写心理活动']],
  ['我出门（没合上的括号也算', '我出门', ['没合上的括号也算']],
  ['我说 (中文) 和（全角）混着', '我说 和混着', ['中文','全角']]
];
for(const [inp,act,asks] of cases){
  const r=await ev(t=>splitAsk(t),inp);
  ok(`「${inp}」→ 行动「${act}」，要求 ${asks.length} 条`, r.act===act&&JSON.stringify(r.asks)===JSON.stringify(asks));
}

console.log('\n【言出法随那一档】');
await ev(()=>fdSetAll('free'));
const P=await ev(()=>({wr:worldRules(), wr2:worldRules(), tp:turnPrompt('我走进酒馆（写得慢一点，把掌柜的表情写细）（这一回合写两千字）',{fate:10,check:null})}));
ok('【言出法随】里有括号那一段', P.wr.includes('玩家在行动里用括号写的'));
ok('写明压过字数、段落这些写作条款', P.wr.includes('压过【写作要求】里的字数'));
ok('写明银钱、修为、寿元、日子仍由引擎记账（甲）', P.wr.includes('由引擎记账')&&P.wr.includes('playerChanges 里只填这一回合实实在在到手的数'));
ok('写明两条边界照旧（守住）', P.wr.includes('上面那两条办不成的边界照旧'));
ok('静态前缀连续两次一字不差', P.wr===P.wr2);
ok('提示词里行动只剩括号外面那句', P.tp.includes('【玩家本回合行动】我走进酒馆\n'));
ok('要求逐条列出', P.tp.includes('【玩家对这一回合的推演要求（逐条照办）】\n1. 写得慢一点，把掌柜的表情写细\n2. 这一回合写两千字'));
const only=await ev(()=>turnPrompt('（这一回合只写心理活动）',{fate:10,check:null}));
ok('只有括号没有行动：行动那栏写明只有要求', only.includes('这一回合没写具体行动')&&only.includes('1. 这一回合只写心理活动'));

// 括号里的字不触发过界、不影响挑属性
const eng=await ev(()=>{ const a='我在屋里打坐（写他想去西陆的心思，写他拔剑的冲动）'; return {travel:travelIntent(actOnly(a)), attr:guessAttr(actOnly(a)||a), attrRaw:guessAttr(a)}; });
ok('括号里写「西陆」不触发过界', !eng.travel);
ok('挑属性只看括号外面（'+eng.attr+'）', eng.attr!==undefined);
// 真走一回合：人不能被带去西陆
const realm0=await ev(()=>S.realm);
page._sent=[];
await page.fill('#freeInput','我在屋里打坐（写他想去西陆的心思，写长一点）'); await page.click('#sendBtn');
await page.waitForFunction(()=>!busy,null,{timeout:25000}).catch(()=>{}); await page.waitForTimeout(300);
const sent=(page._sent||[]).join('\n');
ok('真走一回合：人还在原地', await ev(()=>S.realm)===realm0);
ok('真走一回合：发出去的提示词里要求单独列出', sent.includes('【玩家本回合行动】我在屋里打坐')&&sent.includes('1. 写他想去西陆的心思，写长一点'));
ok('回显里括号那段是浅色', await ev(()=>{ const e=[...document.querySelectorAll('.chapter .action-echo')].pop(); return !!e&&!!e.querySelector('.ask')&&e.querySelector('.ask').textContent.includes('写他想去西陆'); }));

// 面谈
const CP=await ev(()=>{ const n=S.npcs[0]; convo={npc:n.name,msgs:[],favorTotal:0}; const t=convoPrompt(n,'（拍拍他的肩）你先别急（讲当年的事，讲细一点）',10,null); convo=null; return t; });
ok('面谈：这一句只剩「你先别急」', CP.includes('【主角这一句/这一举动】你先别急\n'));
ok('面谈：括号里的动作与要求单独列出', CP.includes('1. 拍拍他的肩')&&CP.includes('2. 讲当年的事，讲细一点'));

// 甲：括号要钱，账上不多进（引擎口径不变：playerChanges 照旧由引擎按规矩入账）
ok('甲：提示词没有叫模型按括号里的数填 playerChanges', !P.tp.includes('照括号里的数填'));

console.log('\n【另两档不动】');
for(const lv of ['mid','strict']){
  const r=await ev(v=>{ fdSetAll(v); const n=S.npcs[0]; convo={npc:n.name,msgs:[],favorTotal:0};
    const cp=convoPrompt(n,'（拍拍他的肩）你先别急',10,null); convo=null;
    return {tp:turnPrompt('我走进酒馆（写得慢一点）',{fate:10,check:null}), cp, act:actOnly('我去西陆（看看）'), echo:echoHtml('我走（慢点）')}; }, lv);
  ok(`${lv}：行动原样（括号不拆）`, r.tp.includes('【玩家本回合行动】我走进酒馆（写得慢一点）\n【本回合引擎判定'));
  ok(`${lv}：没有推演要求那一栏`, !r.tp.includes('【玩家对这一回合的推演要求'));
  ok(`${lv}：面谈原样`, r.cp.includes('【主角这一句/这一举动】（拍拍他的肩）你先别急\n【'));
  ok(`${lv}：引擎照旧看整句`, r.act==='我去西陆（看看）');
  ok(`${lv}：回显不染色`, !r.echo.includes('class="ask"'));
}
if(hasOld){
  const old=await open(br,encodeURI(OLD));
  for(const lv of ['mid','strict']){
    const a=await ev(v=>{ fdSetAll(v); return worldRules(); }, lv);
    const b=await old.evaluate(v=>{ fdSetAll(v); return worldRules(); }, lv);
    ok(`${lv}：worldRules 与改前一字不差`, a===b);
  }
}

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
const errs=page._errs;
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
ok('全程无页面报错', errs.length===0);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})();
