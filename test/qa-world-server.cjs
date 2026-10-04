const http=require('http'),fs=require('fs'),path=require('path');
const {pickBody,sse,serve}=require('./mock');
const root=path.join(__dirname,'..'),port=19447;
const fixture=`<script>localStorage.setItem('wanjie_cfg',JSON.stringify({base:'http://127.0.0.1:${port}/api',key:'fixture-only',model:'fixture',think:false}));</script>`;
const control=`<script>
window.addEventListener('error',e=>{document.getElementById('qaOutput').textContent+=' PAGE ERROR: '+e.message;});
window.addEventListener('load',()=>{
 const box=document.createElement('div');box.id='qaControls';box.style='position:fixed;right:8px;bottom:8px;z-index:15000;background:#fff8df;color:#222;padding:10px;max-width:450px;font:14px sans-serif;border:1px solid #999';
 box.innerHTML='<button id="qaScenario">准备世界推演场景</button> <button id="qaMediate">调停并停战</button> <button id="qaBetray">背约</button> <button id="qaCheck">校验落账与旧档</button> <button id="qaSave">保存测试档</button><div id="qaOutput">本地模拟接口，仅测试；不调用真实模型。</div>';
 document.body.appendChild(box);const show=t=>document.getElementById('qaOutput').textContent=t;
 document.getElementById('qaScenario').onclick=()=>{if(!S||busy){show('先通过正常界面开局');return;}fdSet('act','free');fdSet('peril','free');S.worldStories={};S.world.events=[];S.ties['东荒-西陆']=20;S.realm='东荒';S.scene=normScene({location:'轮枢和谈会场',unresolved:['查清旧案']});S.gateOpen=false;S.voidP=20;seedStories([{title:'东荒与西陆的边境战争',realms:['东荒','西陆'],stage:'双方开战'}],'东荒');seedStories([{title:'西陆商队运粮',stage:'正在准备'}],'西陆');S.treaties={};S.npcs=[];S.vendettas=[];saveGame();renderPanel();renderWorld();show('场景就绪：战争进行中，两界关系20；旧案悬着。');};
 document.getElementById('qaMediate').onclick=()=>act('调停东荒与西陆的战争，签订停战约定',{type:'normal',days:3});
 document.getElementById('qaBetray').onclick=()=>act('撕毁东荒与西陆的停战盟约',{type:'normal',days:3});
 document.getElementById('qaCheck').onclick=()=>{try{
  if(!S)throw Error('请先开局');const original=S;const copy=JSON.parse(JSON.stringify(S));let checks=0;
  const ok=(b,t)=>{if(!b)throw Error(t);checks++;};
  try{S=copy;S.scene=normScene({location:'会场',unresolved:['旧案']});applyTurn({scene:{unresolved:[]}},'结案',{fate:10,days:0});ok(S.scene.unresolved.length===0,'旧案未清');
   S.npcs=[normNpc({name:'长寿修士',age:100,lifespan:1000,'修为':80})];const random=Math.random;Math.random=()=>0.01;try{npcYearTick();}finally{Math.random=random;}ok(S.npcs[0].alive,'长寿NPC病故');
   S.npcs=[normNpc({name:'玉皇大帝',age:100,lifespan:1000})];S.npcs[0]['修为']=0;rankRefresh();ok(S.npcs[0]['修为']===0,'废功恢复');
   S.world.fallen.push({name:'元始天尊'});rankRefresh();rankRefresh();ok(!S.world.ranking.some(r=>r.name==='元始天尊'),'死亡重现');
   S.v=25;S=migrate(S);ok(S.v===26,'旧档未升级');
   const local=S.world.events.slice();S.realm='西陆';syncWorldEvents();ok(S.world.events.every(t=>!t.includes('东荒与西陆的边境战争')),'跨界串事');S.realm='东荒';syncWorldEvents();
   S.history=[{summary:'闭关',progressed:true},{summary:'闭关',progressed:true},{summary:'闭关',progressed:true}];ok(stuckLevel()===0,'强制岔开');
   const prompt=turnPrompt('继续闭关',{fate:10,days:3});ok(prompt.includes('worldEventUpdates')&&prompt.includes('npcRelationUpdates'),'协议未接入');
  }finally{S=original;renderPanel();renderWorld();saveGame();}
  show('PASS '+checks+' 浏览器语义检查；正常页面渲染、旧档迁移、跨界事件和提示词均通过。');
 }catch(e){show('FAIL: '+e.message);}};
 document.getElementById('qaSave').onclick=()=>{saveGame();show('已保存测试档：第'+S.turn+'回，关系'+Math.round(S.ties['东荒-西陆'])+'，事件'+S.world.events.join('；'));};
});</script>`;
http.createServer((q,r)=>{
 if(q.url.startsWith('/api/chat/completions')){let body='';q.on('data',x=>body+=x);q.on('end',()=>{try{
  const b=JSON.parse(body);const prompt=b.messages[b.messages.length-1].content;let d=pickBody(prompt);
  if(prompt.includes('请推演本回合')&&prompt.includes('【玩家本回合行动】调停东荒')){
   const id=(prompt.match(/"id":"(e_[^"]+)"[^\n]*?东荒与西陆的边境战争/)||[])[1]||'e_1';
   d={narrative:'和谈会场里，双方代表验过主角带来的证据，签下半年停战约定。守军收到撤回的命令，商队得以重新通行。主角调查的旧案也已经结清，不再列为悬事。',summary:'调停战争，双方停战',scene:{location:'和谈会场',unresolved:[]},worldEventUpdates:[{id,stage:'双方签订半年停战约定',status:'完成',reason:'双方代表签字，守军已接令'}],worldEffects:[{kind:'调停',eventId:id,realms:['东荒','西陆'],tie:10,truce:true,duration:180,reason:'双方同意停战'}],options:[{text:'继续核查停战的执行情况',type:'normal',days:3},{text:'就地休息',type:'rest',days:3},{text:'了解西陆商队的近况',type:'normal',days:3}],rumors:[],npcEvents:[],gameOver:false};
  }else if(prompt.includes('请推演本回合')&&prompt.includes('【玩家本回合行动】撕毁东荒')){
   const id=(prompt.match(/"id":"(e_[^"]+)"[^\n]*?东荒与西陆的边境战争/)||[])[1]||'e_1';
   d={narrative:'主角当众撕毁了停战盟约。使者带着碎纸离开会场，双方失去了先前的信任。停战保障已失效，这件背约成为新的冲突。',summary:'公开背约，停战失效',scene:{location:'和谈会场',unresolved:['背约后的交涉']},newWorldEvents:[{title:'停战后的背约冲突',realm:'东荒',realms:['东荒','西陆'],stage:'使者已经抗议',reason:'主角公开毁约'}],worldEffects:[{kind:'背约',eventId:id,realms:['东荒','西陆'],tie:-12,reason:'主角撕毁停战盟约'}],options:[{text:'处理背约的后果',type:'normal',days:3},{text:'就地休息',type:'rest',days:3},{text:'听取使者的抗议',type:'normal',days:3}],rumors:[],gameOver:false};
  }
  if(d.questUpdates)d.questUpdates=d.questUpdates.map(u=>({...u,stage:'发现新的调查线索',evidence:'本次调查获得新证据'}));
  r.writeHead(200,{'Content-Type':'text/event-stream','Access-Control-Allow-Origin':'*'});r.end(sse(d));
 }catch(e){r.writeHead(500);r.end(e.message);}});return;}
 if(q.url.split('?')[0]==='/qa'){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('<head>','<head>'+fixture).replace('</body>',control+'</body>');
  r.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});r.end(html);return;
 }
 if(q.url==='/sw.js'){r.writeHead(404);r.end('QA disables offline cache');return;}
 serve(q,r);
}).listen(port,'127.0.0.1',()=>console.log('QA http://127.0.0.1:'+port+'/qa'));
