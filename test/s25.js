// S25 规范 v4.5：提示词分区与缓存、判定口径、人物记忆、数值闸门
// 用法：node test/s25.js（需 playwright；容器里用 PW_CHROME 指定 chromium）
const {chromium}=require('playwright');
const http=require('http');
const {pickBody,sse,serve}=require('./mock');
const srv=http.createServer(serve);
const fails=[],oks=[];
const ok=(n,c)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n); };

(async()=>{
srv.listen(8985);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
const page=await (await br.newContext({viewport:{width:1400,height:900}})).newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
const sent=[];
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData());
  sent.push(b.messages.map(m=>m.content).join('\n\u0000\n'));
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await page.goto('http://localhost:8985/'); await page.waitForTimeout(400);
await page.click('#jieGrid .jiebtn[data-k="东荒"]'); await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});
const ev=(f,a)=>page.evaluate(f,a);
const idle=()=>page.waitForFunction(()=>!busy,null,{timeout:25000});
const cp=(a,b)=>{ let i=0; while(i<a.length&&i<b.length&&a[i]===b[i]) i++; return i; };

console.log('\n【一·提示词分区与缓存】');
for(const t of ['在观里练功','去镇上打听消息','读书']){ await idle(); await ev(t=>act(t,{type:'normal',days:3}),t); await page.waitForTimeout(300); await idle(); }
const turns=sent.filter(x=>x.includes('请推演本回合。'));
const hits=[]; for(let i=1;i<turns.length;i++) hits.push(cp(turns[i-1],turns[i])/turns[i].length);
console.log('    相邻两回合相同开头占比：'+hits.map(x=>(x*100).toFixed(1)+'%').join('、'));
ok('相邻两回合能命中缓存的开头 ≥ 75%', hits.length>=2&&hits.every(x=>x>=0.75));
const P=await ev(()=>{
  const j={fate:10,days:3};
  const tp=turnPrompt('试',j), head=promptHead();
  const duel={log:[{plain:'第一合'}],resultText:'主角胜',opp:{name:'甲',identity:'x','修为':50,signature:''}};
  const dp=duelAftermathPrompt('试',j,duel);
  return {tp,head,dp,t:tp.indexOf('【当前时间】'),r:tp.indexOf('【每回合的写法'),f:tp.indexOf('输出格式：'),tail:tp.lastIndexOf('【动笔前再核一遍】')};
});
ok('规则、输出格式排在【当前时间】前面', P.r>0&&P.f>P.r&&P.t>P.f);
ok('回合与比武余波共用同一个开头', P.tp.startsWith(P.head)&&P.dp.startsWith(P.head));
ok('收尾提醒排在最后', P.tail>P.t&&P.tp.length-P.tail<600);
ok('常规回合要 700-1000 字', P.tp.includes('700-1000字'));
ok('机制通则不再叫模型自己掷骰', !P.tp.includes('你必须自行设定难度')&&P.tp.includes('成败只由引擎判'));
ok('时间口径按日', P.tp.includes('由引擎按日推进'));
ok('风闻与 npcEvents 的规则只各写一处', (P.tp.match(/rumors至多两条/g)||[]).length===1&&(P.tp.match(/npcEvents至多2条/g)||[]).length===1);
ok('过一个月、没有新事，B 区一字不变（旧账不再挂「几个月前」）', await ev(()=>{ const a=stableBlocks(); S.months+=1; const b=stableBlocks(); S.months-=1; return a===b; }));
ok('旧账满一卷就封进 B 区，之后再记不改已封的', await ev(()=>{
  const keep=S.factArchive.slice(); S.factArchive=[]; const C=ledgerChunk();
  for(let i=0;i<C+5;i++) S.factArchive.push('第1回·测试　事'+i);
  const a=ledgerParts(); S.factArchive.push('第1回·测试　又一事'); const b=ledgerParts();
  const r=a.sealed.length===C&&a.open.length===5&&a.sealed.join()===b.sealed.join()&&b.open.length===6;
  S.factArchive=keep; return r;
}));
ok('面谈：同一场里两句话的开头一直相同到【对话至今】', await ev(()=>{
  const n=S.npcs.find(x=>x.alive); convo={npc:n,msgs:[],favorTotal:0};
  const a=convoPrompt(n,'近来可好',10,null,null); convo.msgs.push({role:'me',text:'近来可好'},{role:'npc',text:'还行'}); n['好感度']+=3;
  const b=convoPrompt(n,'告辞',10,null,null); convo=null;
  let i=0; while(a[i]===b[i]) i++;
  return i>=a.indexOf('【对话至今】')&&a.indexOf('规则：')<a.indexOf('【你扮演的人');
}));

console.log('\n【二·自由输入的判定】');
ok('练功、赶路、问路、读书、打坐、买药不掷骰', await ev(()=>['在观里练功','赶路去轮枢','去镇上问路','读书','打坐','去镇上买药','继续练功'].every(t=>riskOf(t)===null)));
ok('说服、偷、硬闯、威胁、动手才掷骰', await ev(()=>riskOf('说服掌柜').attr==='谈吐'&&riskOf('夜里去偷账本').attr==='修为'&&riskOf('硬闯山门')&&riskOf('威胁他交出解药').attr==='修为'&&riskOf('跟他打一架').attr==='修为'));
await idle(); await ev(()=>{ fdSetAll('mid'); window._j=null; const r=runTurn; window.runTurn=async(a,j)=>{ window._j=j; }; act('在观里练功',{type:'normal',days:3}).then(()=>{ window.runTurn=r; }); });
await page.waitForTimeout(300);
ok('传奇档里练功没有判定', await ev(()=>window._j&&window._j.check===null));
await ev(()=>{ busy=false; const r=window.runTurn; window._j=null; window.runTurn=async(a,j)=>{ window._j=j; }; act('潜入账房偷账本',{type:'normal',days:1}).then(()=>{ window.runTurn=r; }); });
await page.waitForTimeout(300);
ok('潜入偷东西有判定', await ev(()=>window._j&&!!window._j.check&&window._j.check.attr==='修为'));
await ev(()=>{ busy=false; });

console.log('\n【三·人物记忆】');
await ev(()=>{
  S.npcs.push(normNpc({name:'远房表叔',gender:'男',age:50,identity:'货郎',relation:'远亲',realm:'东荒','好感度':40}));
  const n=findNpc('远房表叔'); n.lastSeen=-100;
  S.npcs.push(normNpc({name:'沈清',gender:'女',age:24,identity:'云台观弟子',faction:'云台观',relation:'同门'}));
  S.npcs.push(normNpc({name:'王掌柜',gender:'男',age:50,identity:'客栈掌柜',faction:'',relation:'相识'}));
});
ok('没点名时，久不见面的远亲不在「眼下要紧的人」里，但名册有他', await ev(()=>{ const t=stateBlocks('随便走走'); const a=t.indexOf('【眼下要紧的人'); return !t.slice(a,t.indexOf('【当世格局】')).includes('"name":"远房表叔"')&&t.includes('- 远房表叔｜男｜50岁'); }));
ok('玩家点了名，就把他的资料摊开', await ev(()=>{ const t=stateBlocks('去找远房表叔借点盘缠'); const a=t.indexOf('【眼下要紧的人'); return t.slice(a,t.indexOf('【当世格局】')).includes('"name":"远房表叔"'); }));
ok('师父不在眼前，也照样给资料（在场名单只作标注）', await ev(()=>{ const m=S.npcs.find(n=>n.relation==='师父'); S.scene.present=['沈清']; const r=isRelevantNpc(m,'')&&!npcOnScene(m); S.scene.present=null; return r; }));
await ev(()=>{ S.scene.present=['沈清']; applyTurn({narrative:'x',summary:'跟沈清一道练剑',npcUpdates:[{name:'沈清','好感度':3,memory:'主角替她挡过一刀'}]},'跟沈清练剑',{fate:10,days:3}); });
ok('回合里的往来由引擎自己记一笔', await ev(()=>findNpc('沈清').memory.some(x=>x.includes('跟沈清一道练剑'))));
ok('npcUpdates.memory 进「记一辈子的事」', await ev(()=>findNpc('沈清').keyFacts.includes('主角替她挡过一刀')));
ok('往来存 30 条，记一辈子的事不跟着挤掉', await ev(()=>{ const n=findNpc('沈清'); for(let i=0;i<50;i++) npcRemember(n,'第'+i+'回：闲话'); return n.memory.length===30&&n.keyFacts.includes('主角替她挡过一刀'); }));
ok('备注只追加，不被一句话冲掉', await ev(()=>{ const n=findNpc('沈清'); n.notes='欠主角一个人情'; applyTurn({narrative:'x',summary:'x',npcUpdates:[{name:'沈清',notes:'怕打雷'}]},'试',{fate:10,days:1}); return n.notes.includes('欠主角一个人情')&&n.notes.includes('怕打雷'); }));
ok('换个叫法登场（沈清师姐）并进旧档，记成别名', await ev(()=>{ const c=S.npcs.length; applyTurn({narrative:'x',summary:'x',newNpcs:[{name:'沈清师姐',gender:'女',faction:'云台观'}]},'试',{fate:10,days:1}); return S.npcs.length===c&&findNpc('沈清').aliases.includes('沈清师姐')&&findNpc('沈清师姐')===findNpc('沈清'); }));
ok('模型给的别名能认人', await ev(()=>{ applyTurn({narrative:'x',summary:'x',npcUpdates:[{name:'沈清',aliases:['小清']}]},'试',{fate:10,days:1}); return findNpc('小清')===findNpc('沈清'); }));
ok('「王掌柜之子」不会被当成王掌柜', await ev(()=>{ const c=S.npcs.length; applyTurn({narrative:'x',summary:'x',newNpcs:[{name:'王掌柜之子',gender:'男',age:20,identity:'少东家'}]},'试',{fate:10,days:1}); return S.npcs.length===c+1; }));
ok('玩家行动里写到的新人，原话存进档案并进名册', await ev(()=>{
  applyTurn({narrative:'x',summary:'x',newNpcs:[{name:'林小雨',gender:'女',age:18,identity:'渔家女',relation:'萍水相逢'}]},'我在河边遇见了林小雨，她是个哑巴，左手有疤。我问她家在哪。',{fate:10,days:1});
  const n=findNpc('林小雨'); return n&&n.playerWords[0].includes('哑巴')&&stableBlocks().includes('【玩家原话】我在河边遇见了林小雨，她是个哑巴，左手有疤。');
}));
await ev(()=>showNpc(findNpc('林小雨')));
await page.fill('#npcCanon','天生不会说话，只用手语；绝不离开渔村');
await page.click('#npcCanonSave');
ok('人物详情里能写设定，记下后进名册', await ev(()=>findNpc('林小雨').canon.includes('只用手语')&&stableBlocks().includes('【玩家设定】天生不会说话')));
ok('面谈提示词里带着玩家设定，标明最高优先级', await ev(()=>{ const n=findNpc('林小雨'); convo={npc:n,msgs:[],favorTotal:0}; const t=convoPrompt(n,'你好',10,null,null); convo=null; return t.includes('【玩家给林小雨定的设定（最高优先级'); }));
ok('模型改不了设定', await ev(()=>{ applyTurn({narrative:'x',summary:'x',npcUpdates:[{name:'林小雨',canon:'能说会道',notes:'话很多'}]},'试',{fate:10,days:1}); return findNpc('林小雨').canon.includes('只用手语'); }));
await ev(()=>$('npcMask').classList.remove('on'));
ok('死因与日期进「已亡故」', await ev(()=>{ applyTurn({narrative:'x',summary:'王掌柜被山贼砍死在店门口',npcUpdates:[{name:'王掌柜',alive:false}]},'试',{fate:10,days:1}); const t=stableBlocks(); return /王掌柜（[^）]*山贼砍死/.test(t); }));
ok('v26 老档迁到 v27，人物补上别名、设定、要事', await ev(()=>{ const d=JSON.parse(JSON.stringify(S)); d.v=26; d.npcs.forEach(n=>{ delete n.aliases; delete n.canon; delete n.keyFacts; delete n.playerWords; }); const m=migrate(d); return m.v===27&&m.npcs.every(n=>Array.isArray(n.aliases)&&typeof n.canon==='string'&&Array.isArray(n.keyFacts)&&Array.isArray(n.playerWords)); }));

console.log('\n【四·数值闸门】');
ok('传奇档：声望一回合至多 +8，起居注说明', await ev(()=>{ fdSetAll('mid'); const p=S.player, b=p['声望']; lastDeltas={}; applyTurn({narrative:'x',summary:'x',playerChanges:{fame:{'声望':100}}},'试',{fate:10,days:3}); return p['声望']-b===Math.min(8,100-b)&&(lastDeltas['_got']||[]).some(x=>x.includes('削到 +8')); }));
ok('随心所欲档：放到 +20', await ev(()=>{ fdSetAll('free'); const p=S.player; p['声望']=10; applyTurn({narrative:'x',summary:'x',playerChanges:{fame:{'声望':100}}},'试',{fate:10,days:3}); const r=p['声望']===30; fdSetAll('mid'); return r; }));
ok('判定没过：新功法、新物件、拜入势力一律不给', await ev(()=>{
  const p=S.player, a=p.arts.length, f=p.faction, items=JSON.stringify(p.items);
  applyTurn({narrative:'x 天庭 x',summary:'x',playerChanges:{artsAdd:[{name:'九天玄功',style:'绝学',level:30}],itemsAdd:{'法宝':[{name:'金砖'}]},faction:'天庭'}},'说服天兵',{fate:10,days:1,check:{attr:'谈吐',success:false,val:1,roll:2,mod:-34,need:55,total:0}});
  return p.arts.length===a&&p.faction===f&&JSON.stringify(p.items)===items;
}));
ok('新功法熟练度压到 45、一回合只收一门', await ev(()=>{
  const p=S.player, a=p.arts.length;
  applyTurn({narrative:'x',summary:'x',playerChanges:{artsAdd:[{name:'天罡剑',style:'绝学',level:100},{name:'地煞刀',style:'刚猛',level:20}]}},'试',{fate:10,days:30});
  const n=p.arts.find(x=>x.name==='天罡剑'); return p.arts.length===a+1&&n.level===45;
}));
ok('新物件一回合至多 3 件', await ev(()=>{ const p=S.player, c=Object.values(p.items).flat().length; applyTurn({narrative:'x',summary:'x',playerChanges:{itemsAdd:{'其他':[{name:'甲物'},{name:'乙物'},{name:'丙物'},{name:'丁物'},{name:'戊物'}]}}},'试',{fate:10,days:3}); return Object.values(p.items).flat().length===c+3; }));
ok('NPC 好感一回合至多 +20；救命之恩放到 +50', await ev(()=>{
  const n=findNpc('远房表叔'); n['好感度']=20;
  applyTurn({narrative:'x',summary:'聊了几句',npcUpdates:[{name:'远房表叔','好感度':60}]},'试',{fate:10,days:1});
  const a=n['好感度']; n['好感度']=20;
  applyTurn({narrative:'x',summary:'主角从狼口里救了他一命',npcUpdates:[{name:'远房表叔','好感度':60}]},'试',{fate:10,days:1});
  return a===40&&n['好感度']===70;
}));
ok('好感不到线，关系写不成「妻子」；动了情、爱恋到 60 才行', await ev(()=>{
  const n=findNpc('沈清'); n['好感度']=30; n['爱恋值']=null;
  applyTurn({narrative:'x',summary:'x',npcUpdates:[{name:'沈清',relation:'妻子'}]},'试',{fate:10,days:1});
  const a=n.relation; n['爱恋值']=70;
  applyTurn({narrative:'x',summary:'x',npcUpdates:[{name:'沈清',relation:'妻子'}]},'试',{fate:10,days:1});
  return a==='同门'&&n.relation==='妻子';
}));
ok('功夫不如主角的人，不能写成师父', await ev(()=>{ const n=findNpc('远房表叔'); n['修为']=1; applyTurn({narrative:'x',summary:'x',npcUpdates:[{name:'远房表叔',relation:'师父'}]},'试',{fate:10,days:1}); return n.relation==='远亲'; }));
ok('NPC 修为一回合至多 ±8', await ev(()=>{ const n=findNpc('远房表叔'); n['修为']=30; applyTurn({narrative:'x',summary:'x',npcUpdates:[{name:'远房表叔','修为':50}]},'试',{fate:10,days:1}); return n['修为']===38; }));
ok('一回合新登场至多 2 人，没上榜的新人修为不高过榜尾', await ev(()=>{
  const c=S.npcs.length;
  applyTurn({narrative:'x',summary:'x',newNpcs:[{name:'甲路人',gender:'男',age:30,'修为':99},{name:'乙路人',gender:'男',age:30},{name:'丙路人',gender:'男',age:30},{name:'丁路人',gender:'男',age:30}]},'试',{fate:10,days:1});
  return S.npcs.length===c+2&&findNpc('甲路人')['修为']<=rankFloor()+4&&!findNpc('丙路人');
}));
ok('首领还活着、也没对应的大事，模型换不了首领', await ev(()=>{ const f=S.world.factions.find(x=>x.leader&&!npcDead(x.leader)); const l=f.leader; applyTurn({narrative:'x',summary:'x',factionUpdates:[{name:f.name,leader:'无名小卒',power:50}]},'试',{fate:10,days:1}); return f.leader===l; }));
ok('势力权势一回合至多 ±8', await ev(()=>{ const f=S.world.factions[0]; f.power=40; applyTurn({narrative:'x',summary:'x',factionUpdates:[{name:f.name,power:50}]},'试',{fate:10,days:1}); return f.power===48; }));
ok('没交代来路的势力不认；退回散人照办', await ev(()=>{ const p=S.player; p.faction='云台观'; applyTurn({narrative:'他点了点头',summary:'x',playerChanges:{faction:'九幽魔宫'}},'试',{fate:10,days:1}); const a=p.faction; applyTurn({narrative:'x',summary:'x',playerChanges:{faction:'散人'}},'试',{fate:10,days:1}); return a==='云台观'&&p.faction==='散人'; }));

console.log('\n通过 '+oks.length+' 项，失败 '+fails.length+' 项');
ok('全程无页面报错', errs.length===0);
if(errs.length) console.log('页面报错：\n'+errs.slice(0,6).join('\n'));
await br.close(); srv.close();
process.exit(fails.length?1:0);
})();
