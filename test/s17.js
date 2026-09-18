// S17 随行门槛（规范 v3.4 第三节）
const {chromium}=require('playwright');
const http=require('http');
const {pickBody,sse,serve}=require('./mock');
const srv=http.createServer(serve);
const fails=[],oks=[];
const ok=(n,c)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n); };
let page;

(async()=>{
srv.listen(8973);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
page=await (await br.newContext({viewport:{width:1400,height:900}})).newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData());
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await page.goto('http://localhost:8973/'); await page.waitForTimeout(400);
await page.click('#jieGrid .jiebtn[data-k="东荒"]'); await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});

// 造一个人放进名录；不走 autoFollow
const put=n=>page.evaluate(o=>{ const x=normNpc(o); x.realm=jieName(); x.follow=false; S.npcs=S.npcs.filter(y=>y.name!==x.name); S.npcs.push(x); return x.name; },n);
const why=nm=>page.evaluate(n=>followBlock(findNpc(n)),nm);
await page.evaluate(()=>{ S.player.attributes['修为']=50; S.player.attributes['谈吐']=60; S.npcs.forEach(n=>n.follow=false); });

console.log('\n【第一道：关系】');
await put({name:'路人甲',gender:'男',age:30,relation:'萍水相逢','好感度':99});
ok('萍水相逢再怎么熟也不行', /谈不上同行/.test(await why('路人甲')));
await put({name:'同门师兄',gender:'男',age:30,relation:'同门','好感度':99});
ok('同门也不行', /谈不上同行/.test(await why('同门师兄')));
await put({name:'仇人的侍卫',gender:'男',age:30,relation:'仇人的侍卫','好感度':99});
ok('「仇人的侍卫」不会被侍卫两个字蒙过去', /谈不上同行/.test(await why('仇人的侍卫')));
await put({name:'阿福',gender:'男',age:18,relation:'书童','好感度':45});
ok('书童算从属，门槛 40', (await why('阿福'))==='');

console.log('\n【第二道：好感】');
await put({name:'冷道侣',gender:'女',age:25,relation:'道侣','好感度':50});
ok('道侣好感不到 55 请不动，且说得出还差几', /还差 5/.test(await why('冷道侣')));
await page.evaluate(()=>{ findNpc('冷道侣')['好感度']=55; });
ok('好感补够就行了', (await why('冷道侣'))==='');
await put({name:'生死兄弟',gender:'男',age:30,relation:'结义兄弟','好感度':80});
ok('生死之交门槛最高，要 85', /还差 5/.test(await why('生死兄弟')));

console.log('\n【第三道：修为】');
await put({name:'高徒',gender:'男',age:20,relation:'徒弟','好感度':90,'修为':80});
ok('修为高过主角十五以上就请不动', /修为远在你之上/.test(await why('高徒')));
await page.evaluate(()=>{ findNpc('高徒')['修为']=60; });
ok('差在十五以内就行', (await why('高徒'))==='');
await put({name:'老仆',gender:'男',age:60,relation:'随从','好感度':50,'修为':95});
ok('从属不看修为——卖了身的不讲这个', (await why('老仆'))==='');

console.log('\n【第四道：身份】');
await put({name:'太上老君',gender:'男',age:9999,relation:'道侣','好感度':100,'修为':10});
ok('至高那几位，好感一百也不跟你走', /不会跟着谁走|走不开/.test(await why('太上老君')));
await put({name:'安倍晴明',gender:'男',age:60,relation:'结义兄弟','好感度':100,'修为':10});
ok('一势力之首走不开', /走不开|不会跟着谁走/.test(await why('安倍晴明')));
await put({name:'唐僧',gender:'男',age:30,relation:'结义兄弟','好感度':88,'修为':10});
ok('名宿、成名那两档要好感 90', /不到 90/.test(await why('唐僧')));
await page.evaluate(()=>{ const n=findNpc('唐僧'); n['好感度']=95; n['修为']=10; });
ok('好感够了、修为又不高过主角，就请得动', (await why('唐僧'))==='');
await page.evaluate(()=>{ findNpc('唐僧')['修为']=90; });
ok('修为在主角之上还是不行', /修为.*在你之上/.test(await why('唐僧')));

console.log('\n【三个人的上限与异界】');
await page.evaluate(()=>{ S.npcs.forEach(n=>n.follow=false);
  for(const nm of ['甲','乙','丙']){ const x=normNpc({name:nm,relation:'随从','好感度':60}); x.realm=jieName(); S.npcs.push(x); setFollow(x,true,true); } });
ok('满三个就带不动第四个', /最多带 3 个/.test(await why('阿福')));
await page.evaluate(()=>{ findNpc('丙').follow=false; findNpc('阿福').realm='西陆'; });
ok('人远在别界，先得见上面', /远在西陆/.test(await why('阿福')));
await page.evaluate(()=>{ findNpc('阿福').realm=jieName(); });

console.log('\n【开口请人：要掷骰】');
ok('请不动会掉好感，且当回合不许再缠着问', await page.evaluate(()=>{
  const n=findNpc('阿福'); n['好感度']=45; n.follow=false; n.askFollowTurn=-1;
  const d=Math.random; Math.random=()=>0.001;                 // 掷出低点数，必败（非大失败）
  const r1=askFollow(n); Math.random=d;
  const dropped=n['好感度']<45, again=askFollow(n);
  return r1===false&&dropped&&again===false&&n.follow===false;
}));
ok('骰子好就跟上了', await page.evaluate(()=>{
  const n=findNpc('阿福'); n['好感度']=70; n.follow=false; n.askFollowTurn=-1;
  const d=Math.random; Math.random=()=>0.999; const r=askFollow(n); Math.random=d;
  return r===true&&n.follow===true;
}));
ok('不够格的连骰都不掷', await page.evaluate(()=>{
  const n=findNpc('路人甲'); n.askFollowTurn=-1; const before=n['好感度'];
  return askFollow(n)===false&&n['好感度']===before&&n.follow!==true;
}));

console.log('\n【口粮】');
ok('每带一个人，每月开销多三成', await page.evaluate(()=>{
  S.npcs.forEach(n=>n.follow=false);
  const base=upkeepPerMonth();
  findNpc('甲').follow=true; const one=upkeepPerMonth();
  findNpc('乙').follow=true; const two=upkeepPerMonth();
  window.__up=[base,one,two];
  return one>base&&two>one&&Math.abs(one-Math.round(base*1.3))<=2;
}));

console.log('\n【界面】');
ok('不够格的按钮是灰的，并写明差在哪', await page.evaluate(()=>{
  const n=findNpc('路人甲'); showNpc(n);
  const b=$('npcFollowBtn'), t=$('npcMBody').textContent;
  $('npcMask').classList.remove('on');
  return !!b&&b.disabled===true&&t.includes('谈不上同行');
}));
ok('够格的按钮能点，写的是「请他同行」', await page.evaluate(()=>{
  const n=findNpc('冷道侣'); n.follow=false; n['好感度']=70; showNpc(n);
  const b=$('npcFollowBtn'); const okk=!!b&&!b.disabled&&b.textContent.includes('请他同行');
  $('npcMask').classList.remove('on'); return okk;
}));
ok('已经跟着的人，按钮是「让他留下」', await page.evaluate(()=>{
  const n=findNpc('甲'); showNpc(n);
  const b=$('npcFollowBtn'); const okk=!!b&&!b.disabled&&b.textContent.includes('让他留下');
  $('npcMask').classList.remove('on'); return okk;
}));

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(fails.length) console.log('开销=',await page.evaluate(()=>window.__up));
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
ok('全程无页面报错', errs.length===0);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})();
