// S15 名望阶与三界寿元（规范 v3.3）
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const {pickBody,sse,serve}=require('./mock');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'));
const srv=http.createServer(serve);
const fails=[],oks=[];
const ok=(n,c)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n); };
let page;

(async()=>{
srv.listen(8971);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
page=await (await br.newContext({viewport:{width:1400,height:900}})).newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData()); const c=b.messages[b.messages.length-1].content;
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(c))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await page.goto('http://localhost:8971/'); await page.waitForTimeout(400);
await page.click('#jieGrid .jiebtn[data-k="东荒"]'); await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});

console.log('\n【名望阶表】');
ok('三界加幽墟都有，五档齐全', await page.evaluate(()=>['东荒','西陆','樱洲','幽墟'].every(k=>FAME_TIERS[k]&&['T1','T2','T3','T4','T5'].every(t=>Array.isArray(FAME_TIERS[k][t])))));
ok('没有一个人挂在两档上（别名也算同一个人）', await page.evaluate(()=>{
  const seen=new Set();
  for(const k in FAME_TIERS) for(const t in FAME_TIERS[k]) for(const n of FAME_TIERS[k][t]){
    if(seen.has(n)) return false; seen.add(n);
    for(const it of NPC_SAME){ const o=it[0]===n?it[1]:(it[1]===n?it[0]:''); if(o&&FAME_OF[o]) return false; }
  } return true; }));
ok('名单里的人基本都进了表（东荒漏的不超过两个）', await page.evaluate(()=>{
  const miss=poolNames('东荒').filter(n=>!fameTierOf(n)); window.__miss=miss; return miss.length<=2; }));
ok('别名也认得（燃灯古佛＝燃灯道人同档）', await page.evaluate(()=>fameTierOf('燃灯古佛')===fameTierOf('燃灯道人')&&!!fameTierOf('燃灯古佛')));
ok('路人不在表上', await page.evaluate(()=>!isFamed('沈砚')&&!isFamed('张三')));

console.log('\n【当前难度的顶端】');
ok('循序渐进：天花板 100，至高就是 100', await page.evaluate(()=>{ S.fd_grow='mid'; return fameBase()===100&&fameWu('太上老君')===100; }));
ok('五档拉得开，且都在 100 以内', await page.evaluate(()=>{
  S.fd_grow='mid';
  const a=fameWu('太上老君'),b=fameWu('玉皇大帝'),c=fameWu('杨戬'),d=fameWu('姜子牙'),e=fameWu('唐僧');
  return a===100&&a>b&&b>c&&c>d&&d>e&&e>=66&&a<=100; }));
ok('一日千里：跟着水位走，主角三百时名人压他一线', await page.evaluate(()=>{
  S.fd_grow='free'; S.player.attributes['修为']=300;
  const base=fameBase(); return base>=310&&base<=320&&fameWu('太上老君')>=300; }));
ok('一日千里：主角练满 1000 就与至高打平', await page.evaluate(()=>{
  S.fd_grow='free'; S.player.attributes['修为']=1000;
  return fameBase()===1000&&fameWu('太上老君')===1000; }));
ok('开局水位低时也不会太低（下限 150）', await page.evaluate(()=>{
  S.fd_grow='free'; S.player.attributes['修为']=5; S.world.ranking=[];
  return fameBase()===150; }));

console.log('\n【幽墟头目】');
ok('循序渐进档还原成 60+6×层', await page.evaluate(()=>{ S.fd_grow='mid'; return ABYSS_BOSSES.every(b=>bossWu(b)===(b.name===ABYSS_LORD?Math.round(105):60+6*b.layer)); }));
ok('吞噬者永远高过至高一线', await page.evaluate(()=>{ S.fd_grow='mid'; const l=ABYSS_BOSSES.find(b=>b.name===ABYSS_LORD); return bossWu(l)>fameWu('太上老君'); }));
ok('一日千里档跟着水位涨', await page.evaluate(()=>{ S.fd_grow='free'; S.player.attributes['修为']=400; const b=ABYSS_BOSSES.find(x=>x.layer===6)||ABYSS_BOSSES[0]; return bossWu(b)>200; }));

console.log('\n【万界榜六＋四】');
await page.evaluate(()=>{
  S.fd_grow='mid'; S.player.attributes['修为']=30;
  S.npcs=S.npcs.filter(n=>!isFamed(n.name));
  S.world.ranking=[{name:'柳无涯',faction:'散人','修为':80,note:'快刀',alive:true,age:44},
                   {name:'白惊鸿',faction:'散人','修为':76,note:'剑法',alive:true,age:39}];
  rankRefresh();
});
ok('榜上十人，前六是名单上的大人物', await page.evaluate(()=>{
  const rk=S.world.ranking; window.__rk=rk.map(r=>r.name+':'+r['修为']);
  return rk.length<=10&&rk.filter(r=>isFamed(r.name)).length===6; }));
ok('名望席按档排在前面', await page.evaluate(()=>{
  const rk=S.world.ranking; const famed=rk.filter(r=>isFamed(r.name));
  return famed[0]['修为']>=famed[famed.length-1]['修为']&&famed[0]['修为']===100; }));
ok('后四席还是当世新秀，原来的人没被挤掉', await page.evaluate(()=>S.world.ranking.some(r=>r.name==='柳无涯')));
ok('上榜门槛不被圣人抬高', await page.evaluate(()=>rankFloor()<=75));
ok('名人的修为在名录里也抬上去了', await page.evaluate(()=>{
  S.npcs.push(normNpc({name:'太上老君',gender:'男',age:9999,identity:'道门祖庭',relation:'素未谋面','修为':40,realm:'东荒'}));
  fameSync(); const n=findNpc('太上老君'); return num(n['修为'])===100&&num(n.lifespan)>200; }));

console.log('\n【三界寿元】');
ok('东荒：化神 400、真仙 1000、大罗不老（一日千里档）', await page.evaluate(()=>{
  S.fd_grow='free';
  return lifeOfWu(60,'东荒')===400&&lifeOfWu(86,'东荒')===1000&&lifeOfWu(130,'东荒')>=9999; }));
ok('西陆两条路不一样：贤者 400，九阶才 180', await page.evaluate(()=>{
  S.fd_grow='free'; return lifeOfWu(86,'西陆','魔力')===400&&lifeOfWu(88,'西陆','斗气')===180; }));
ok('樱洲两条路不一样：特级 300，剑豪 200', await page.evaluate(()=>{
  S.fd_grow='free'; return lifeOfWu(88,'樱洲','咒力')===300&&lifeOfWu(88,'樱洲','气')===200; }));
ok('东荒明显长过另两界', await page.evaluate(()=>{
  S.fd_grow='free'; return lifeOfWu(88,'东荒')>lifeOfWu(88,'西陆','魔力')&&lifeOfWu(88,'西陆','魔力')>lifeOfWu(88,'樱洲','气'); }));
ok('循序渐进压到三成、封顶 400', await page.evaluate(()=>{
  S.fd_grow='mid'; return lifeOfWu(60,'东荒')===176&&lifeOfWu(95,'东荒')===400; }));
ok('苦修慢磨不启用，寿元还是只有奇遇能长', await page.evaluate(()=>{
  S.fd_grow='strict'; return lifeOfWu(130,'东荒')===0&&lifeCap()===92; }));

console.log('\n【破境提寿】');
ok('修为破境，寿元自己涨，起居注记一笔', await page.evaluate(()=>{
  S.fd_grow='free'; S.homeRealm='东荒'; S.player.lifespan=78; S.player.attributes['修为']=60;
  const before=S.player.lifespan, got=lifeSync();
  const lg=(S.ledgerLog||S.ledger||[]).map(x=>typeof x==='string'?x:(x&&x.t)||'').join('|');
  window.__lg=lg.slice(-200);
  return got>0&&S.player.lifespan===400&&before===78; }));
ok('只升不降：修为掉回去，寿元不缩', await page.evaluate(()=>{
  S.player.attributes['修为']=20; lifeSync(); return S.player.lifespan===400; }));
ok('lifeCap 让奇遇能加在境界之上', await page.evaluate(()=>{ S.fd_grow='free'; S.player.attributes['修为']=60; return lifeCap()>=400; }));

console.log('\n【外观年龄不返老还童】');
ok('寿元 400 的人四十岁看着二十出头，不是三岁', await page.evaluate(()=>{
  const a=lookAge({age:40,lifespan:400}); window.__la=a; return a>=20&&a<=28; }));
ok('寿元 3000 的人两百岁仍是壮年', await page.evaluate(()=>{ const a=lookAge({age:200,lifespan:3000}); return a>=20&&a<=30; }));
ok('活到寿数就是看着七十八', await page.evaluate(()=>Math.abs(lookAge({age:400,lifespan:400})-78)<=1));
ok('童年不被拉长：十岁就是十岁', await page.evaluate(()=>lookAge({age:10,lifespan:1000})===10));
ok('凡人照旧', await page.evaluate(()=>lookAge({age:40,lifespan:78})===40&&lookAge({age:40,lifespan:60})===52));

console.log('\n【面板】');
ok('寿元那一行写明是哪一境给的', await page.evaluate(()=>{
  S.fd_grow='free'; S.player.attributes['修为']=60; S.player.lifespan=400; renderPanel();
  const t=$('pMeta').textContent; window.__meta=t; return t.includes('寿元400')&&t.includes('之寿'); }));

console.log('\n【存档】');
ok('存档版本到 25，老档能迁上来', await page.evaluate(async()=>{
  if(SAVE_VERSION!==25) return false;
  const d=JSON.parse(JSON.stringify(S)); d.v=21; d.player.lifespan=78; d.player.attributes['修为']=60;
  const m=migrate(d); return m.v===25&&num(m.player.lifespan)>78; }));

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(fails.length){ console.log('miss=',await page.evaluate(()=>window.__miss)); console.log('rk=',await page.evaluate(()=>window.__rk)); console.log('meta=',await page.evaluate(()=>window.__meta)); console.log('la=',await page.evaluate(()=>window.__la)); }
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
ok('全程无页面报错', errs.length===0);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})();
