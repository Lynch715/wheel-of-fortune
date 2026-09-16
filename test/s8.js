// S8 起居注对账、念叨去重
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
srv.listen(8962);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
const ctx=await br.newContext({viewport:{width:1400,height:900}});
page=await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
page.on('console',m=>{ if(m.type()==='error'&&!/Failed to load resource/.test(m.text())) errs.push('console:'+m.text()); });
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData());
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await page.goto('http://localhost:8962/');
await page.waitForTimeout(400);
await page.click('#jieGrid .jiebtn[data-k="东荒"]');
await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});

console.log('\n【起居注与面板对账】');
const r=await page.evaluate(()=>{
  const n0=S.npcs[0]; const f0=num(n0['好感度']); n0['好感度']=50;
  const d={narrative:'x',summary:'x',playerChanges:{attributes:{'谈吐':2},
    skills:{'画符':'略通'},artsAdd:[{name:'太清剑诀',desc:'x',style:'刚猛',level:20},{name:S.player.arts[0]?S.player.arts[0].name:'无名',desc:'x',style:'刚猛',level:20}],
    itemsAdd:{'丹药':[{name:'聚气丹'}],'武器':[{name:'青锋剑',bonus:8}],'符箓':['镇妖符'],'魔导器':[{name:'星辉法杖'}]},itemsRemove:['不存在的东西']},
    npcUpdates:[{name:n0.name,'好感度':'+10'},{name:'查无此人','好感度':5}]};
  applyTurn(d,'试',{fate:10,months:1});
  renderPanel(); renderBag();
  const lines=changeLines(d);
  const bag=['bagWeapons','bagManuals','bagMeds','bagPoisons','bagBooks','bagMisc'].map(id=>$(id).innerHTML).join('');
  return {lines, bag, cats:Object.keys(S.player.items), fav:n0['好感度'], skill:S.player.skills['画符'], n0:n0.name};
});
ok('只有六个栏，没有隐形栏', r.cats.sort().join()===['法宝','典籍','医药','毒药','杂书','其他'].sort().join());
ok('丹药进医药、武器和魔导器进法宝', await page.evaluate(()=>S.player.items['医药'].some(x=>x.name==='聚气丹')&&S.player.items['法宝'].some(x=>x.name==='青锋剑')&&S.player.items['法宝'].some(x=>x.name==='星辉法杖')));
ok('起居注里得到的东西，行囊里都看得见', ['聚气丹','青锋剑','镇妖符','星辉法杖'].every(x=>r.bag.includes(x)&&r.lines.some(l=>l.includes(x))));
ok('好感真的加了，起居注写的是实际的数', r.fav===60&&r.lines.some(l=>l.includes(r.n0+' 好感 +10（今 60）')));
ok('对不上号的人不写进起居注', !r.lines.some(l=>l.includes('查无此人')));
ok('已经会的功法不再写「习得」', r.lines.filter(l=>l.includes('习得功法')).length===1);
ok('没丢的东西不写「失去」', !r.lines.some(l=>l.includes('不存在的东西')));
ok('文字技艺也记上了', !!r.skill&&r.skill.desc==='略通'&&r.lines.some(l=>l.includes('画符')));
ok('面谈给东西也归栏', await page.evaluate(()=>itemCat('武器','断水刀')==='法宝'&&itemCat('','回春丹')==='医药'&&itemCat('怪东西','一块石头')==='其他'));
ok('老档里的隐形栏读档时挪回来', await page.evaluate(()=>{
  const s=JSON.parse(JSON.stringify(S)); s.v=16; s.player.items['丹药']=[{name:'老丹'}]; s.player.items['兵器']=[{name:'老刀'}];
  migrate(s);
  return s.v===17&&!s.player.items['丹药']&&s.player.items['医药'].some(x=>x.name==='老丹')&&s.player.items['法宝'].some(x=>x.name==='老刀')&&Array.isArray(s.ledgerAt)&&s.ledgerAt.length===s.ledger.length;
}));

console.log('\n【念叨】');
ok('换个说法算同一件事', await page.evaluate(()=>sameThing('查清沈师姐的死因','沈师姐到底怎么死的，要查清')&&!sameThing('查清沈师姐的死因','去青石镇买药')));
ok('未了之事换说法不重置挂起时间', await page.evaluate(()=>{
  const sc=sceneU(); sc.unresolved=[]; sc.uAge={}; sc.uMon={}; S.turnedPage=[];
  addUnresolved('查清沈师姐的死因'); const m0=sc.uMon['查清沈师姐的死因'];
  S.months+=3; addUnresolved('沈师姐到底怎么死的，要查清');
  return sc.unresolved.length===1&&sc.unresolved[0]==='沈师姐到底怎么死的，要查清'&&sc.uMon[sc.unresolved[0]]===m0;
}));
ok('挂满六个月没下文就搁下，进「已翻篇」', await page.evaluate(()=>{
  S.months+=3; ageUnresolved();
  return sceneU().unresolved.length===0&&turnedLive().length===1&&S.ledger.some(x=>/搁下一桩久无下文的事/.test(x));
}));
ok('翻篇的事模型再塞回来也不收', await page.evaluate(()=>{ addUnresolved('沈师姐的死因还没查清'); return sceneU().unresolved.length===0; }));
ok('提示词里有「已经翻篇的事」', await page.evaluate(()=>stateBlocks().includes('【已经翻篇的事')&&stateBlocks().includes('沈师姐到底怎么死的')));
ok('一年后翻篇的记录自己淡掉', await page.evaluate(()=>{ S.months+=12; const a=turnedLive().length===0&&!stateBlocks().includes('【已经翻篇的事'); addUnresolved('沈师姐的死因还没查清'); const b=sceneU().unresolved.length===1; sceneU().unresolved=[]; return a&&b; }));
ok('旧账带着几个月前，标题写明是核对用的', await page.evaluate(()=>{
  ledger('测试用的一笔旧账'); S.months+=5; const t=stateBlocks();
  return t.includes('测试用的一笔旧账（5个月前）')&&t.includes('不是本回合的素材');
}));
ok('本月记的写「本月」', await page.evaluate(()=>{ ledger('刚记的一笔'); return ledgerText(5).includes('刚记的一笔（本月）'); }));
ok('同一句风闻半年里只推一次', await page.evaluate(()=>{
  S.engineNews=[]; news('一句重复的风闻'); S.engineNews=[]; news('一句重复的风闻'); const a=S.engineNews.length===0;
  S.months+=6; news('一句重复的风闻'); return a&&S.engineNews.length===1;
}));
ok('走两回合不报错', await (async()=>{ for(let i=0;i<2;i++){ await page.evaluate(()=>document.querySelector('#choices .opt').click()); await idle(); await page.evaluate(()=>document.querySelectorAll('.modal-mask.on').forEach(m=>m.classList.remove('on'))); } return true; })());

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
ok('全程无页面报错', errs.length===0);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})();
