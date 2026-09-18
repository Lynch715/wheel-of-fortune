// S9 换界：口头换界、随行、人物按界分、每回标明在哪
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
srv.listen(8963);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
const ctx=await br.newContext({viewport:{width:1400,height:900}});
page=await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
page.on('console',m=>{ if(m.type()==='error'&&!/Failed to load resource/.test(m.text())) errs.push('console:'+m.text()); });
let lastPrompt='';
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData());
  const c=b.messages[b.messages.length-1].content; lastPrompt=c;
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(c))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await page.goto('http://localhost:8963/');
await page.waitForTimeout(400);
await page.click('#jieGrid .jiebtn[data-k="东荒"]');
await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});
const act=async t=>{ await page.fill('#freeInput',t); await page.click('#sendBtn'); await idle(); await page.waitForTimeout(200); await page.evaluate(()=>document.querySelectorAll('.modal-mask.on').forEach(m=>m.classList.remove('on'))); };

console.log('\n【口头换界的识别】');
ok('认得出「去轮枢」「回东荒」「下幽墟」', await page.evaluate(()=>travelIntent('收拾行李去轮枢')==='轮枢'&&travelIntent('我要下幽墟看看')==='幽墟'&&(S.realm='轮枢',travelIntent('回东荒老家')==='东荒')&&(S.realm='东荒',true)));
ok('不去、打听消息、别界来的人都不算', await page.evaluate(()=>!travelIntent('我不去轮枢')&&!travelIntent('打听西陆的消息')&&!travelIntent('去找轮枢来的商人')&&!travelIntent('在东荒四处走走')));
ok('三界之间先落到轮枢', await page.evaluate(()=>travelLeg('西陆')==='轮枢'&&travelLeg('轮枢')==='轮枢'));

console.log('\n【随行】');
ok('好感够了的伴侣默认跟着走，普通人不跟（v3.4 起看四道门槛）', await page.evaluate(()=>{
  const a=normNpc({name:'柳青娥',gender:'女',age:25,relation:'道侣',identity:'散修','好感度':70}); S.npcs.push(a); autoFollow(a);
  const b=normNpc({name:'王掌柜',gender:'男',age:50,relation:'熟人',identity:'掌柜','好感度':90}); S.npcs.push(b); autoFollow(b);
  const c=normNpc({name:'冷道侣',gender:'女',age:25,relation:'道侣','好感度':30}); S.npcs.push(c); autoFollow(c);
  return a.follow===true&&b.follow===false&&c.follow===false;   // 关系对但好感不够，也跟不了
}));
ok('最多带三个', await page.evaluate(()=>{
  for(const nm of ['甲徒','乙徒','丙徒']){ const n=normNpc({name:nm,gender:'男',age:16,relation:'徒弟','好感度':80}); S.npcs.push(n); autoFollow(n); }
  return followers().length===3;
}));
await page.evaluate(()=>{ findNpc('丙徒').follow=false; S.player.money=99999; S.player.items['其他']=[]; });

console.log('\n【口头换界：去轮枢】');
const home=await page.evaluate(()=>S.npcs.find(n=>!n.follow&&n.alive).name);
await act('收拾行李，动身去轮枢');
ok('引擎真的过了界', await page.evaluate(()=>S.realm==='轮枢'&&S.ledger.some(x=>/过界到轮枢/.test(x))));
ok('颜色跟着换了', await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()===JIE['轮枢'].tint));
ok('随行的人一道到了轮枢，留下的还在东荒', await page.evaluate(h=>followers().every(n=>n.realm==='轮枢')&&findNpc(h).realm==='东荒'&&findNpc('丙徒').realm==='东荒',home));
ok('提示词里写着玩家原话和引擎办完过界', lastPrompt.includes('动身去轮枢')&&lastPrompt.includes('引擎已办完过界'));
ok('提示词列了随行的人', lastPrompt.includes('【随行的人')&&lastPrompt.includes('柳青娥'));
ok('东荒的旧识没进「眼下要紧的人」', await page.evaluate(h=>{ const t=stateBlocks(); const a=t.indexOf('【眼下要紧的人】'), b=t.indexOf('【别处的旧识'); return t.slice(a,b).indexOf(h)<0&&t.slice(b).indexOf(h)>=0; },home));
ok('这一回的抬头写着轮枢，签条是轮枢的颜色', await page.evaluate(()=>{
  const c=Array.from(document.querySelectorAll('#story .chapter')).pop();
  return c.querySelector('.chaptime').textContent.includes('◎ 轮枢')&&c.querySelector('.chapmark').style.background!=='';
}));

console.log('\n【人物名录按界分】');
ok('名录分成随行、在轮枢、远在别界', await page.evaluate(()=>{ renderPeople(); const t=$('npcList').textContent; return t.includes('随行')&&t.includes('远在别界')&&t.indexOf('随行')<t.indexOf('远在别界'); }));
ok('远在别界的人不能面谈、不能切磋', await page.evaluate(h=>{ const n=findNpc(h); openConvo(n); const noConvo=!$('convoMask').classList.contains('on'); showNpc(n); const dis=$('npcTalkBtn').disabled&&$('npcDuelBtn').disabled; $('npcMask').classList.remove('on'); return noConvo&&dis; },home));
ok('人物详情里能改随行（请回来要掷骰，所以直接用 setFollow 验按钮在）', await page.evaluate(()=>{
  const n=findNpc('柳青娥'); showNpc(n); const b=$('npcFollowBtn'); b.click(); const off=n.follow===false;
  showNpc(n); const b2=$('npcFollowBtn'); const canAsk=!!b2&&!b2.disabled;
  setFollow(n,true); $('npcMask').classList.remove('on'); return off&&canAsk&&n.follow===true; }));
ok('人间琐记里远在别界的人被拿掉，写明哪界传来的保留', await page.evaluate(h=>{
  const r=hereEvents([`${h}最近娶了亲`,`东荒传来消息：${h}最近娶了亲`,'柳青娥在集市上跟人吵了一架']);
  return r.length===2&&r[0].startsWith('东荒传来');
},home));
ok('模型让够格的人跟上算数，让萍水相逢的人跟上不算（v3.4）', await page.evaluate(()=>{
  const a=normNpc({name:'酒馆的佣兵',gender:'男',age:30,relation:'萍水相逢'}); a.realm='轮枢'; S.npcs.push(a); autoFollow(a);
  const b=normNpc({name:'阿福',gender:'男',age:20,relation:'书童','好感度':60}); b.realm='轮枢'; b.follow=false; S.npcs.push(b);
  findNpc('乙徒').follow=false;
  applyTurn({narrative:'x',summary:'x',npcUpdates:[{name:'酒馆的佣兵',follow:true},{name:'阿福',follow:true}]},'试',{fate:10,months:0});
  return a.follow===false&&b.follow===true&&changeLines({}).some(l=>l.includes('阿福 跟在了你身边'));
}));

console.log('\n【三界不直达、去不了】');
await act('启程去西陆');
ok('从轮枢去西陆直接过去了', await page.evaluate(()=>S.realm==='西陆'));
await page.evaluate(()=>{ S.player.money=0; });
await act('回东荒');
ok('钱不够就不走，人还在西陆，风闻里写明被挡住', await page.evaluate(()=>S.realm==='西陆')&&lastPrompt.includes('没走成')&&lastPrompt.includes('盘缠不够'));
await page.evaluate(()=>{ S.player.money=99999; });
await act('回东荒去');
ok('西陆去东荒先落到轮枢', await page.evaluate(()=>S.realm==='轮枢')&&lastPrompt.includes('不直达'));
ok('铁律写明换界只由引擎办', lastPrompt.includes('换界只由引擎办'));

console.log('\n【存档】');
ok('老档补随行：好感够的伴侣跟，不在同一界的、好感不够的、熟人都不跟', await page.evaluate(()=>{
  const s=JSON.parse(JSON.stringify(S)); s.v=17; s.realm='东荒';
  s.npcs=[{name:'甲',relation:'妻子',realm:'东荒',alive:true,'好感度':70},
          {name:'乙',relation:'徒弟',realm:'西陆',alive:true,'好感度':80},
          {name:'丙',relation:'熟人',realm:'东荒',alive:true,'好感度':95},
          {name:'丁',relation:'妻子',realm:'东荒',alive:true,'好感度':30}];
  migrate(s);
  return s.v===SAVE_VERSION&&s.npcs[0].follow===true&&s.npcs[1].follow===false&&s.npcs[2].follow===false&&s.npcs[3].follow===false;
}));

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
ok('全程无页面报错', errs.length===0);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})();
