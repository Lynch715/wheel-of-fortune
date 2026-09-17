// S12 法宝加成、新人入册、同回合好感
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
srv.listen(8966);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
page=await (await br.newContext({viewport:{width:1400,height:900}})).newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData()); const c=b.messages[b.messages.length-1].content;
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(c))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await page.goto('http://localhost:8966/'); await page.waitForTimeout(400);
await page.click('#jieGrid .jiebtn[data-k="东荒"]'); await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});

console.log('\n【法宝】');
ok('没写加成的法宝也加修为', await page.evaluate(()=>{
  S.player.items['法宝']=[];
  applyTurn({narrative:'x',summary:'x',playerChanges:{itemsAdd:{'法宝':[{name:'青霜短剑',desc:'薄而利'}]}}},'试',{fate:10,days:1});
  const it=S.player.items['法宝'][0];
  return it.bonus>=6&&it.bonus<=11&&weaponBonus(S.player)===it.bonus&&attrVal(S.player,'修为')>=S.player.attributes['修为']+it.bonus-15;
}));
ok('神器一档更高，残破的更低，幽墟的最高', await page.evaluate(()=>autoBonus({name:'先天灵宝·混元伞'})>=14&&autoBonus({name:'锈铁剑'})<=4&&autoBonus({name:'骨刃',cursed:true})>=20));
ok('写了加成就照写的来', await page.evaluate(()=>{ applyTurn({narrative:'x',summary:'x',playerChanges:{itemsAdd:{'法宝':[{name:'明光剑',bonus:3}]}}},'试',{fate:10,days:1}); return S.player.items['法宝'].find(x=>x.name==='明光剑').bonus===3; }));
ok('面板修为显示合计', await page.evaluate(()=>{ renderPanel(); const t=$('pAttrs').textContent; const v=S.player.attributes['修为'], wb=weaponBonus(S.player); return t.includes(`本身${v}＋法宝${wb}`)&&t.includes(String(v+wb)); }));
ok('老档里没加成的法宝读档时补上', await page.evaluate(()=>{ const s=JSON.parse(JSON.stringify(S)); s.v=19; s.player.items['法宝']=[{name:'旧剑'}]; migrate(s); return s.player.items['法宝'][0].bonus>0; }));

console.log('\n【新人与好感】');
ok('同一回合新认识又加好感，好感算上', await page.evaluate(()=>{
  applyTurn({narrative:'x',summary:'x',newNpcs:[{name:'柳如烟',gender:'女',age:22,identity:'船娘',relation:'萍水相逢','好感度':40}],npcUpdates:[{name:'柳如烟','好感度':10}]},'试',{fate:10,days:1});
  const n=findNpc('柳如烟'); const l=changeLines({});
  return n&&n['好感度']===50&&l.some(x=>x.includes('结识新人物【柳如烟】'))&&l.some(x=>x.includes('柳如烟 好感 +10（今 50）'));
}));
ok('只在 npcUpdates 里出现、有身份的人也收进名录', await page.evaluate(()=>{
  applyTurn({narrative:'x',summary:'x',npcUpdates:[{name:'渡口老艄公',identity:'艄公',relation:'萍水相逢','好感度':5}]},'试',{fate:10,days:1});
  const n=findNpc('渡口老艄公'); renderPanel();
  return !!n&&n['好感度']===35&&$('npcList').textContent.includes('渡口老艄公');
}));
ok('光有名字没来头的不收', await page.evaluate(()=>{ const c=S.npcs.length; applyTurn({narrative:'x',summary:'x',npcUpdates:[{name:'某个过客','好感度':5}]},'试',{fate:10,days:1}); return S.npcs.length===c; }));
ok('起居注里结识的人，人脉页都有', await page.evaluate(()=>{ renderPanel(); const t=$('npcList').textContent; return ['柳如烟','渡口老艄公'].every(x=>t.includes(x)); }));

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
ok('全程无页面报错', errs.length===0);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})();
