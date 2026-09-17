// S14 隐藏宝物
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
srv.listen(8968);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
page=await (await br.newContext({viewport:{width:1400,height:900}})).newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
let lastPrompt='';
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData()); const c=b.messages[b.messages.length-1].content; if(c.includes('请推演本回合')) lastPrompt=c;
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(c))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await page.goto('http://localhost:8968/'); await page.waitForTimeout(400);
await page.click('#jieGrid .jiebtn[data-k="东荒"]'); await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});
const give=(nm,cat)=>page.evaluate(([nm,cat])=>{ applyTurn({narrative:'x',summary:'x',playerChanges:{itemsAdd:{[cat||'法宝']:[{name:nm,bonus:1,desc:'模型乱写的'}]}}},'试',{fate:10,days:1}); return changeLines({}); },[nm,cat]);

console.log('\n【表】');
ok('二十五件，五界都有', await page.evaluate(()=>TREASURES.length===25&&REALM_KEYS.every(R=>TREASURES.some(t=>t.realm===R))&&new Set(TREASURES.map(t=>t.key)).size===25));
ok('别名认得', await page.evaluate(()=>treasureOf('定海神针').key==='jingubang'&&treasureOf('《天丛云剑》').key==='caozhijian'&&treasureOf('一柄普通长剑')===null));

console.log('\n【到手】');
const l1=await give('定海神针');
ok('名字换成表里的、加成按表来，模型写的数不算', await page.evaluate(()=>{ const it=S.player.items['法宝'].find(x=>x.treasure==='jingubang'); return !!it&&it.name==='如意金箍棒'&&it.bonus===28&&weaponBonus(S.player)===28; }));
ok('起居注写得到珍宝', l1.some(x=>x.includes('得到【如意金箍棒】（珍宝')));
await give('金箍棒');
ok('天下一件，不会再给第二根', await page.evaluate(()=>S.player.items['法宝'].filter(x=>x.treasure==='jingubang').length===1));
ok('提示词里有随身珍宝，名录里有本界藏着的', await page.evaluate(()=>stateBlocks().includes('【主角随身的珍宝')&&jieBlock().includes('本界藏着的珍宝')&&jieBlock().includes('芭蕉扇（翠云山')));
ok('比武多档：芭蕉扇+1、十二天将符+2', await page.evaluate(()=>{ const a=treasureDuel({name:'某人'}); applyTurn({narrative:'x',summary:'x',playerChanges:{itemsAdd:{'其他':[{name:'芭蕉扇'},{name:'十二天将符'}]}}},'试',{fate:10,days:1}); return a===0&&treasureDuel({name:'某人'})===3; }));
ok('童子切对妖多一档', await page.evaluate(()=>{ applyTurn({narrative:'x',summary:'x',playerChanges:{itemsAdd:{'法宝':[{name:'童子切'}]}}},'试',{fate:10,days:1}); return treasureDuel({name:'甲',identity:'山里的鬼'})===treasureDuel({name:'乙',identity:'武士'})+1; }));
ok('九转金丹当场服下：伤全好、寿元涨、不进行囊', await page.evaluate(()=>{ S.player.hp=30; S.scars=[{name:'跛足'}]; const L=lifespanOf(S.player); applyTurn({narrative:'x',summary:'x',playerChanges:{itemsAdd:{'医药':[{name:'九转金丹'}]}}},'试',{fate:10,days:1}); return S.player.hp>=95&&!S.scars.length&&lifespanOf(S.player)>L&&!S.player.items['医药'].some(x=>x.name==='九转金丹'); }));
ok('照妖镜悟性判定 +15', await page.evaluate(()=>{ const a=attrVal(S.player,'悟性'); applyTurn({narrative:'x',summary:'x',playerChanges:{itemsAdd:{'法宝':[{name:'照妖镜'}]}}},'试',{fate:10,days:1}); return attrVal(S.player,'悟性')===a+15; }));
ok('八尺琼勾玉：谈吐 +10，天命骰不低于 3', await page.evaluate(()=>{ const a=attrVal(S.player,'谈吐'); applyTurn({narrative:'x',summary:'x',playerChanges:{itemsAdd:{'其他':[{name:'勾玉'}]}}},'试',{fate:10,days:1}); let mn=20; const r=S.realm; S.realm='东荒'; for(let i=0;i<300;i++) mn=Math.min(mn,fateRoll()); S.realm=r; return attrVal(S.player,'谈吐')===a+10&&mn>=3; }));
ok('万界通行令：过界不花钱', await page.evaluate(()=>{ applyTurn({narrative:'x',summary:'x',playerChanges:{itemsAdd:{'其他':[{name:'万界通行令'}]}}},'试',{fate:10,days:1}); const q=crossQuote('轮枢'); return q.ok&&q.cost===0; }));
ok('月结：金契进账、村正涨恶名、圣杯回满血', await page.evaluate(()=>{
  applyTurn({narrative:'x',summary:'x',playerChanges:{itemsAdd:{'其他':[{name:'商盟金契'},{name:'圣杯'}],'法宝':[{name:'村正'}]}}},'试',{fate:10,days:1});
  S.player.hp=40; const m=S.player.money, e=S.player['恶名'];
  treasureMonth();
  return S.player.money===m+120&&S.player['恶名']===e+2&&S.player.hp===100;
}));
ok('精灵之光：保命一次，碎掉；下幽墟不受侵蚀', await page.evaluate(()=>{
  applyTurn({narrative:'x',summary:'x',playerChanges:{itemsAdd:{'其他':[{name:'水晶瓶'}]}}},'试',{fate:10,days:1});
  const w=hasWard(); const a=saveLife('试'); const b=saveLife('试');
  return w&&a&&!b&&!hasT('jinglingzhiguang')&&S.treasures.jinglingzhiguang.state==='used';
}));
ok('剧情里本该死，宝物挡下', await page.evaluate(()=>{
  applyTurn({narrative:'x',summary:'x',playerChanges:{itemsAdd:{'其他':[{name:'织命者之线'}]}}},'试',{fate:10,days:1});
  const f=S.fd_peril; fdSet('peril','strict'); const e=num(S.erosion);
  applyTurn({narrative:'x',summary:'x',gameOver:true,ending:'死了'},'往前走',{fate:10,days:1});
  fdSet('peril',f);
  return !S.over&&num(S.erosion)===e+2&&S.player.items['其他'].find(x=>x.treasure==='zhimingxian').charms===1;
}));
ok('命运轮签：用满就碎', await page.evaluate(()=>{ applyTurn({narrative:'x',summary:'x',playerChanges:{itemsAdd:{'其他':[{name:'命运轮签'}]}}},'试',{fate:10,days:1}); for(let i=0;i<12;i++) fateRoll(); return !hasT('lunqian'); }));
ok('墟心之眼：幽墟的门没开也能进', await page.evaluate(()=>{ applyTurn({narrative:'x',summary:'x',playerChanges:{itemsAdd:{'其他':[{name:'墟心之眼'}]}}},'试',{fate:10,days:1}); const r=S.realm; S.realm='轮枢'; S.gateOpen=false; const t=crossTargets().find(x=>x.key==='幽墟'); S.realm=r; return t.ok; }));
ok('吞灯是珍宝不走普通幽墟器物的要账', await page.evaluate(()=>{ applyTurn({narrative:'x',summary:'x',playerChanges:{itemsAdd:{'法宝':[{name:'吞灯'}]}}},'试',{fate:10,days:1}); const hp=S.player.hp=80; cursedTick(1); return S.player.hp===80&&weaponBonus(S.player)===35; }));

console.log('\n【丢了再找】');
ok('丢了就算离身，还能再得', await page.evaluate(()=>{
  S.player.items['法宝']=S.player.items['法宝'].filter(x=>x.treasure!=='jingubang'); renderWorld();
  const lost=S.treasures.jingubang.state==='lost';
  applyTurn({narrative:'x',summary:'x',playerChanges:{itemsAdd:{'法宝':[{name:'如意金箍棒'}]}}},'试',{fate:10,days:1});
  return lost&&hasT('jingubang');
}));

console.log('\n【珍宝录】');
ok('万界页有珍宝录：拿到过的显示名字，没拿到的是？？？', await page.evaluate(()=>{ renderWorld(); const t=$('treasureList').textContent; return t.includes('如意金箍棒')&&/还有 \d+ 件没见过/.test(t)&&!t.includes('石中剑')&&/\d+ \/ 25/.test($('treasureSub').textContent); }));
ok('老档里名字对得上的补成珍宝', await page.evaluate(()=>{ const s=JSON.parse(JSON.stringify(S)); s.v=20; s.treasures={}; s.player.items={'法宝':[{name:'草薙剑',bonus:3}],'其他':[]}; migrate(s); return s.v===SAVE_VERSION&&s.player.items['法宝'][0].bonus===28&&s.treasures.caozhijian.state==='held'; }));
await page.evaluate(()=>document.querySelector('#choices .opt').click()); await idle();
ok('走一回合不报错，提示词里带着珍宝', lastPrompt.includes('【主角随身的珍宝')&&lastPrompt.includes('如意金箍棒：修为 +28'));

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
ok('全程无页面报错', errs.length===0);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})();
