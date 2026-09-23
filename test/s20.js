// S20 言出法随（规范 v3.6）：随心所欲档 NPC 不许扭捏；另外两档一个字不改
// 用法：node test/s20.js（需 playwright；容器里用 PW_CHROME 指定 chromium）
// 对照：归档/index_v3.5_言出法随前.html 在就比一比 mid/strict 档的提示词，不在就跳过那两项
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const {pickBody,sse,serve}=require('./mock');
const srv=http.createServer(serve);
const fails=[],oks=[];
const ok=(n,c)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n); };
const OLD='/归档/index_v3.5_言出法随前.html';
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
  await page.goto('http://localhost:8980'+url); await page.waitForTimeout(400);
  await page.click('#jieGrid .jiebtn[data-k="东荒"]'); await page.click('#crStart');
  await page.waitForSelector('#choices .opt',{timeout:25000});
  page._errs=errs; return page;
}

(async()=>{
srv.listen(8980);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
const page=await open(br,'/');
const ev=(f,a)=>(a===undefined?page.evaluate(f):page.evaluate(f,a));

// 一个素不相识、好感 0、修为高过主角的人
const stranger=()=>ev(()=>{
  S.npcs=S.npcs.filter(n=>n.name!=='冷面客');
  S.npcs.push(normNpc({name:'冷面客',gender:'男',age:40,relation:'素未谋面',identity:'散修','好感度':0,'修为':90,
    faction:'散人',realm:'东荒',alignment:'中立',secret:'他杀过自己的师兄'}));
  S.player.attributes['修为']=40; S.player.money=5000;
  return findNpc('冷面客').name;
});

console.log('【提示词：随心所欲档】');
await ev(()=>fdSetAll('free'));
const P=await ev(()=>({wr:worldRules(), wh:worldHead(), wr2:worldRules()}));
ok('worldRules 带【言出法随】', P.wr.includes('【言出法随】'));
ok('worldHead（面谈抬头）带【言出法随】', P.wh.includes('【言出法随】'));
ok('【言出法随】在 tone 之后、TONE_NOTE 之前', P.wr.indexOf('【本局自由度：随心所欲】')<P.wr.indexOf('【言出法随】')&&P.wr.indexOf('【言出法随】')<P.wr.indexOf('上面几段说法不一时'));
ok('同一局连续两次 worldRules 一字不差（缓存前缀不破）', P.wr===P.wr2);
const BAD=['还是「结果」','只要不荒诞','十有八九','写着「不会」的就是真不会','含糊带过','讨价还价、抱怨、推脱'];
for(const w of BAD.slice(0,3)) ok(`worldRules 里搜不到「${w}」`, !P.wr.includes(w));

await stranger();
const CP=await ev(()=>{ convo={npc:'冷面客',msgs:[],favorTotal:0}; const t=convoPrompt(findNpc('冷面客'),'教我你那套剑法',7,null); convo=null; return t; });
ok('面谈：不发掷骰尺子与 need 表', !CP.includes('【引擎掷骰】')&&!CP.includes('这一档的 need 参考'));
ok('面谈：写明不判成败', CP.includes('不判成败'));
ok('面谈：秘密问起就说，不许含糊', CP.includes('照实说出来')&&!CP.includes('含糊带过'));
ok('面谈：那一栏叫「此人手头有什么」，没有「写着不会就是真不会」', CP.includes('此人手头有什么')&&!CP.includes('写着「不会」的就是真不会'));
ok('面谈：没有「谈不成就留空、说明为什么不肯」', !CP.includes('说明白为什么不肯'));
ok('面谈：好感 0 的人那一栏也写着可以送东西、可以引荐', CP.includes('可以送一件随身之物')&&CP.includes('可以引荐入门'));

const TP=await ev(()=>turnPrompt('我去劝冷面客收我为徒',{fate:10,check:null,freeAttr:'谈吐'}));
ok('回合提示词：写作要求里没有「推脱」，换成「应承」', !TP.includes('推脱')&&TP.includes('应承'));
ok('回合提示词：自由行动一律当作做成', TP.includes('一律当作做成了')&&!TP.includes('只要不荒诞'));

console.log('\n【引擎：随心所欲档】');
const caps=await ev(()=>convoCaps(findNpc('冷面客')));
ok('convoCaps：好感 0 也能送东西、教功法、引荐、托付', caps.canItem&&caps.artGate===0&&caps.factionGate===0&&caps.questGate===0&&caps.skillGate===0);
ok('convoCaps：银钱仍有上限（按家底卡）', caps.money>0&&caps.money<=1000&&caps.lifetime>caps.money);
const got=await ev(()=>{
  const n=findNpc('冷面客'); n.taught=false; n.gave=0;
  const before=S.player.money, arts=S.player.arts.length;
  const out=applyConvoEffects(n,{money:300,art:{name:'寒江剑诀',style:'刚猛',level:20},relation:'师父',faction:'云台观',give:[{cat:'其他',name:'旧剑穗'}]},true);
  return {out, dm:S.player.money-before, da:S.player.arts.length-arts, rel:n.relation, fac:S.player.faction};
});
ok('好感 0 的人：钱照给', got.dm===300);
ok('好感 0 的人：功法照教', got.da===1);
ok('好感 0 的人：拜师照认（师父）', got.rel==='师父');
ok('好感 0 的人：引荐照办', got.fac==='云台观');
ok('结算里没有一句「不肯／没舍得／还不到」', !got.out.some(x=>/不肯|没舍得|还不到|没答应/.test(x)));
const over=await ev(()=>{ const n=findNpc('冷面客'); n.gave=0; const out=applyConvoEffects(n,{money:999999},true); return out.join('|'); });
ok('要的钱超出家底：给到上限，措辞是「掏不出来」一类而不是不肯', /给了你 \d+ 两/.test(over)&&!/不肯|没舍得/.test(over));
const src=await ev(()=>document.documentElement.innerHTML);
ok('对话结算：随心所欲档模型误填 success:false 也照样落账', src.includes('fdm().freeAct?true:(d.attempt?d.attempt.success!==false:true)')&&src.includes('if(fdm().freeAct&&d.attempt) d.attempt.success=true'));

const fol=await ev(()=>{ const n=findNpc('冷面客'); n.relation='朋友'; n.identity='散修'; n.follow=false; n.askFollowTurn=null;
  S.npcs.forEach(x=>{ if(x!==n) x.follow=false; });
  const why=followBlock(n); const went=why?false:askFollow(n); return {why, went, f:!!n.follow}; });
ok('请人同行：好感 0、修为高过主角、关系只是朋友，也不拦（'+(fol.why||'无阻拦')+'）', !fol.why);
ok('请人同行：开口就跟着走', fol.went&&fol.f);
const foe=await ev(()=>{ const n=findNpc('冷面客'); n.follow=false; n.relation='仇人'; return followBlock(n); });
ok('请人同行：仇人照旧请不动', !!foe);
await ev(()=>{ const n=findNpc('冷面客'); n.follow=false; n.relation='徒弟'; });

await ev(()=>{ renderOptions([{text:'硬闯',type:'check',check:{attr:'修为',need:100}},{text:'走',type:'normal'}]); });
const tag=await ev(()=>$('choices').innerText);
ok('选项上的判定标「必成」，不标百分比', tag.includes('必成')&&!/约\d+%/.test(tag));

console.log('\n【另外两档不受影响】');
for(const lv of ['mid','strict']){
  const r=await ev(v=>{ fdSetAll(v); const n=findNpc('冷面客'); n.follow=false; n.relation='徒弟'; convo={npc:'冷面客',msgs:[],favorTotal:0};
    const cp=convoPrompt(n,'教我你那套剑法',7,null); convo=null;
    return {wr:worldRules(), cp, caps:convoCaps(n), fol:followBlock(n)}; }, lv);
  ok(`${lv}：没有【言出法随】`, !r.wr.includes('【言出法随】')&&!r.cp.includes('【言出法随】'));
  ok(`${lv}：面谈照旧掷骰、有 need 表`, r.cp.includes('【引擎掷骰】')&&r.cp.includes('这一档的 need 参考'));
  ok(`${lv}：好感 0 的人不教功法`, r.caps.artGate>0&&!r.caps.canItem);
  ok(`${lv}：请人同行照旧看好感`, /好感/.test(r.fol));
}
await ev(()=>{ fdSetAll('mid'); renderOptions([{text:'硬闯',type:'check',check:{attr:'修为',need:60}}]); });
ok('mid：选项照旧标百分比', /约\d+%/.test(await ev(()=>$('choices').innerText)));

if(hasOld){
  const old=await open(br,encodeURI(OLD));
  for(const lv of ['mid','strict']){
    const a=await ev(v=>{ fdSetAll(v); return worldRules(); }, lv);
    const b=await old.evaluate(v=>{ fdSetAll(v); return worldRules(); }, lv);
    ok(`${lv}：worldRules 与改前一字不差`, a===b);
  }
}else console.log('  （没找到改前的归档，跳过对照）');

// 自由档一整回合跑通：真按一次发送，看发出去的提示词
await ev(()=>fdSetAll('free'));
page._sent=[];
await page.fill('#freeInput','我去劝冷面客收我为徒'); await page.click('#sendBtn');
await page.waitForFunction(()=>!busy,null,{timeout:25000}).catch(()=>{});
await page.waitForTimeout(300);
const sent=(page._sent||[]).join('\n');
ok('自由输入走一整回合：发出去的提示词里带【言出法随】、不带「推脱」', sent.includes('【言出法随】')&&!sent.includes('推脱'));
ok('自由输入走一整回合：写着一律当作做成了', sent.includes('一律当作做成了'));
console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
const errs=page._errs;
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
ok('全程无页面报错', errs.length===0);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})();
