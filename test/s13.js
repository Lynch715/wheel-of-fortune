// S13 名人旧交
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
srv.listen(8967);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
page=await (await br.newContext({viewport:{width:1400,height:900}})).newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData()); const c=b.messages[b.messages.length-1].content;
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(c))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await page.goto('http://localhost:8967/'); await page.waitForTimeout(400);
await page.click('#jieGrid .jiebtn[data-k="东荒"]'); await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});

console.log('\n【表】');
ok('三界和跨界都有，条目两百上下', await page.evaluate(()=>{ let n=0; for(const k in NPC_TIES) n+=NPC_TIES[k].length; return ['东荒','西陆','樱洲','跨界'].every(k=>NPC_TIES[k].length>10)&&n>=180; }));
ok('没有重复的一对', await page.evaluate(()=>{ const s=new Set(); for(const k in NPC_TIES) for(const [a,b] of NPC_TIES[k]){ const key=[a,b].sort().join('|'); if(s.has(key)) return false; s.add(key); } return true; }));
ok('两头都查得到', await page.evaluate(()=>tiesOf('唐僧').some(t=>t.who==='猪八戒')&&tiesOf('猪八戒').some(t=>t.who==='唐僧')));
ok('同一个人的别称也认', await page.evaluate(()=>tiesOf('燃灯古佛')[0].same&&tiesOf('燃灯古佛')[0].who==='燃灯道人'&&tiesOf('慈航')[0].who==='观音菩萨'));
ok('西陆樱洲幽墟也有', await page.evaluate(()=>tiesOf('莱戈拉斯').some(t=>t.who==='瑟兰迪尔')&&tiesOf('宫本武藏').some(t=>t.who==='佐佐木小次郎')&&tiesOf('摩根勒菲').some(t=>t.who==='亚瑟王')&&tiesOf('酒吞童子').some(t=>t.who==='源赖光')));

console.log('\n【进提示词和面板】');
await page.evaluate(()=>{ S.npcs.push(normNpc({name:'孙悟空',gender:'男',age:500,identity:'齐天大圣',relation:'萍水相逢'})); S.npcs.push(normNpc({name:'猪八戒',gender:'男',age:500,identity:'天蓬',relation:'萍水相逢'})); });
const sb=await page.evaluate(()=>stateBlocks());
ok('提示词里有名人旧交，两个都认识的人排在前面', sb.includes('【名人旧交')&&sb.includes('孙悟空—猪八戒：师兄弟'));
ok('认识的人资料里带着旧交', await page.evaluate(()=>{ const t=stateBlocks(); const a=t.indexOf('【眼下要紧的人】'); return t.slice(a).includes('"旧交":"猪八戒—唐僧'); }));
ok('规则写明不许写成素不相识', sb.includes('不许写成素不相识')||(await page.evaluate(()=>lawBlock()+worldRules())).includes('不许写成素不相识'));
ok('旧交一块不超过 40 行', await page.evaluate(()=>tiesBlock().split('\n').length<=40));
ok('没认识名人时不塞一大段（只列在场首领之间的）', await page.evaluate(()=>{ const keep=S.npcs; S.npcs=keep.filter(n=>!['孙悟空','猪八戒'].includes(n.name)); const t=tiesBlock(); S.npcs=keep; return !t.includes('孙悟空—'); }));
ok('人物详情里显示旧交', await page.evaluate(()=>{ showNpc(findNpc('猪八戒')); const t=$('npcMBody').textContent; $('npcMask').classList.remove('on'); return t.includes('旧交')&&t.includes('猪八戒—唐僧'); }));
ok('提示词没胖太多（<18500）', await page.evaluate(()=>turnPrompt('试',{fate:10,days:1}).length<18500));

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
ok('全程无页面报错', errs.length===0);
await br.close(); srv.close();
process.exit(fails.length?1:0);
})();
