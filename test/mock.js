// 假的 OpenAI 兼容接口：按提示词类型 + 主角所在的界返回对应 JSON
const R={
  '东荒':{
    factions:[{name:'云台观',type:'宗门',alignment:'正派',power:70,leader:'玄清真人',desc:'东荒玄门一脉'},
              {name:'万妖山',type:'妖族',alignment:'邪道',power:55,leader:'青面大王',desc:'妖族聚居之地'}],
    rank:[['太虚子','散修',92,'一剑开天'],['白绫仙子','月影宫',80,'月影剑诀'],['青面大王','万妖山',66,'铜皮铁骨']],
    events:['大旱','玄门与截门为灵脉起争执'],
    name:'李昭', bg:'修真世家', path:null, faction:'云台观',
    art:{name:'伏虎诀',desc:'刚猛外家法诀',style:'刚猛',level:25},
    weapon:'柳叶剑', manual:'伏虎心法残卷',
    npcs:[['玄清真人','师父','云台观掌教',85,'正派','云台观',62,'男'],
          ['青面大王','仇人','万妖山妖王',66,'邪道','万妖山',44,'男'],
          ['沈师姐','同门','云台观亲传弟子',55,'正派','云台观',24,'女']],
    place:'云台观', open:'雨下了整宿。李昭把剑往案上一搁，要了两个馍。\n跑堂的看了看那剑，手一抖。',
    rumor:['万妖山不太平','轮枢传来：西陆封了三座城'],
    duelTxt:'剑光闪过，两人各自退开。\n围观的人都不敢出声。'
  },
  '西陆':{
    factions:[{name:'白鸢骑士团',type:'骑士团',alignment:'正派',power:70,leader:'雷纳德',desc:'效忠王室的老牌骑士团'},
              {name:'灰塔',type:'魔法塔',alignment:'中立',power:60,leader:'导师维兰',desc:'发执照的地方'}],
    rank:[['剑圣加斯顿','白鸢骑士团',92,'一剑断过巨龙的角'],['贤者伊莲','灰塔',80,'禁咒只念过一次'],['黑袍马卡斯','散人',66,'亡灵法师']],
    events:['两国边境起了战事','教廷宣布某地出了异端'],
    name:'艾德', bg:'落魄骑士之家', path:'斗气', faction:'白鸢骑士团',
    art:{name:'碎盾斩',desc:'斗气外放的重击',style:'刚猛',level:25},
    weapon:'父亲的长剑', manual:'斗气入门手记',
    npcs:[['雷纳德','恩师','白鸢骑士团团长',85,'正派','白鸢骑士团',62,'男'],
          ['黑袍马卡斯','仇人','亡灵法师',66,'邪道','散人',44,'男'],
          ['莉雅','同僚','白鸢骑士团见习骑士',55,'正派','白鸢骑士团',24,'女']],
    place:'王都旧城区', open:'雨把石板路冲得发亮。艾德把断了一半的长剑插回鞘里。\n酒馆老板看了看那剑，手一抖。',
    rumor:['边境的征召令贴到乡下了','轮枢传来：东荒的妖族又闹了一场'],
    duelTxt:'剑锋交错，两人各自退开。\n围观的人都不敢出声。'
  },
  '樱洲':{
    factions:[{name:'一刀流',type:'流派',alignment:'正派',power:70,leader:'北条宗一',desc:'幕府认可的老道场'},
              {name:'星见学园',type:'学园',alignment:'中立',power:65,leader:'学园长',desc:'各家送孩子来的地方'}],
    rank:[['宫本玄斋','一刀流',92,'拔刀快得看不见'],['安倍千鹤','阴阳寮',80,'式神有十二只'],['雾隐左近','散人',66,'叛忍']],
    events:['两藩因旧怨起了争端','某处山里百鬼夜行'],
    name:'真岛悟', bg:'剑豪世家', path:'气', faction:'一刀流',
    art:{name:'岩砕',desc:'正面压上去的一刀',style:'刚猛',level:25},
    weapon:'父亲的太刀', manual:'一刀流目录卷',
    npcs:[['北条宗一','师范','一刀流宗家',85,'正派','一刀流',62,'男'],
          ['雾隐左近','仇人','叛忍',66,'邪道','散人',44,'男'],
          ['白河铃','同学','星见学园二年生',55,'正派','星见学园',24,'女']],
    place:'一刀流道场', open:'道场的木板凉得刺骨。真岛把木刀横在膝上。\n师范推门进来，看了他一眼。',
    rumor:['山里夜里有灯','轮枢传来：西陆起了战事'],
    duelTxt:'刀光一闪，两人各自退开。\n围观的人都不敢出声。'
  },
  '轮枢':{
    factions:[{name:'冒险者公会',type:'冒险者公会',alignment:'中立',power:75,leader:'会长莎菈',desc:'发委托的地方'},
              {name:'万界商盟',type:'商盟',alignment:'中立',power:65,leader:'大掌柜周甫',desc:'倒卖五界的货'}],
    rank:[['无名的S级','冒险者公会',90,'S 级委托没有失手过'],['占星祭司','命运神殿',78,'神殿替他占过三次']],
    events:['公会挂出一张 S 级委托','界门将开的风声起了'],
    name:'客', bg:'随机', path:null, faction:'散人',
    art:{name:'来路不明的一招',desc:'不知从哪学的',style:'诡变',level:25},
    weapon:'旧刀', manual:'旅人手记',
    npcs:[['莎菈','相识','冒险者公会会长',70,'中立','冒险者公会',40,'女']],
    place:'冒险者公会大厅', open:'公会大厅里挂满了委托单，风一吹哗哗地响。',
    rumor:['黑市上多了批来路不明的货','界门要开了'],
    duelTxt:'两人各自退开，谁也没占到便宜。'
  },
  '幽墟':{
    factions:[{name:'枯骨庭',type:'亡灵',alignment:'中立',power:70,leader:'数骨的',desc:'一座不倒的骨城'},
              {name:'噬渊族',type:'魔族',alignment:'邪道',power:80,leader:'长夜',desc:'靠吞食同类变强'}],
    rank:[['长夜','噬渊族',95,'进过无光渊，出来了'],['拾骨人','散人',60,'身上有件谁也认不出的东西']],
    events:['天底的暗红深了一层','有人在无光渊口捡到一件五界的东西'],
    name:'无面', bg:'堕落者', path:null, faction:'散人',
    art:{name:'旧日的一击',desc:'从前学的',style:'刚猛',level:25},
    weapon:'锈了的刀', manual:'半卷残纸',
    npcs:[['拾骨人','相识','在断兵堆里挑拣的堕落者',60,'中立','散人',50,'男'],
          ['长夜','仇人','噬渊族的老东西',95,'邪道','噬渊族',400,'男'],
          ['灰姑','同乡','早年掉下来的堕落者',45,'中立','散人',30,'女']],
    place:'枯骨荒野', open:'天底还是那片暗红，从进来那天起就没动过。\n脚下的地是软的，踩下去会慢半拍才弹回来。',
    rumor:['有人在千骸口听见过说话声','上头的门快松了'],
    duelTxt:'两下交手，各自退开。\n没有人围观，这里没有人围观。'
  }
};
function realmOfPrompt(p){
  const m=p.match(/主角此刻身在「(.{1,3})」/) || p.match(/请为「(.{1,3})」这一界铸造/);
  return (m&&R[m[1]])?m[1]:'东荒';
}
module.exports.R=R; module.exports.realmOfPrompt=realmOfPrompt;

function npc(a,realm){
  const [name,rel,id,w,align,fac,age,gender]=a;
  return {name,gender:gender||'男',age:age||40,identity:id,faction:fac,alignment:align,personality:['暴躁'],
    appearance:'普通',修为:w,谈吐:50,signature:'',relation:rel,好感度:20,爱恋值:null,mood:'平静',alive:true,
    secret:'他有一桩旧案',notes:'',realm};
}
let turnNo=0, aftNo=0;
const AFT=[['照他说的走一趟','动身去探个虚实','那边总得亲自去看看'],
           ['把他托付的东西送到','先把那封信交了','绕个道，了了这桩托付'],
           ['先回去把伤养好','歇上几日','闭门静养，等伤好了再说']];
function aftVary(i){ return AFT[i][(aftNo+i)%AFT[i].length]; }

function pickBody(prompt){
  const k=realmOfPrompt(prompt), d=R[k];
  const foe=(d.npcs[1]||d.npcs[0])[0], pal=(d.npcs[2]||d.npcs[0])[0];
  if(prompt.includes('这一界铸造当世格局')) return {
    factions:d.factions,
    ranking:d.rank.map(r=>({name:r[0],faction:r[1],修为:r[2],note:r[3]})),
    events:d.events};
  if(prompt.includes('现在请生成一位主角并开局')) return {
    player:{name:d.name,biaozi:null,gender:'男',age:22,orientation:'异性恋',appearance:'瘦高',personality:['执拗','重义'],
      backgroundType:d.bg,backstory:'家道中落，父亲死于非命。',
      attributes:{谈吐:42,学识:35,悟性:60,修为:38},path:d.path,声望:8,恶名:2,money:1200,faction:d.faction,
      skills:{'记帐':'识文断字（粗浅）'},
      arts:[d.art],
      items:{法宝:[{name:d.weapon,desc:'父亲遗物',bonus:5}],典籍:[{name:d.manual,desc:'字迹斑驳'}],
             医药:[{name:'伤药'}],毒药:[],杂书:[],其他:[{name:'万界通行证',desc:'不知谁落下的'}]},
      status:[]},
    npcs:d.npcs.map(a=>npc(a,k)),
    quests:[{title:'查明父亲死因',desc:'父亲死得蹊跷'}],
    opening:d.open,
    scene:{location:d.place,unresolved:['父亲的死因']},
    rumors:d.rumor,
    options:[{text:'留在原地打听消息',hint:'稳妥',type:'normal',months:1,check:null,duel:null,target:null},
             {text:'闭关三月',hint:'耗时久',type:'rest',months:3,check:null,duel:null,target:null},
             {text:'去找'+foe+'算账',hint:'凶险',type:'duel',months:1,check:null,duel:{opponent:foe,lethal:false},target:null},
             {text:'找'+pal+'深谈',hint:'',type:'talk',months:1,check:null,duel:null,target:pal}]};
  if(prompt.includes('请把这场比武写成')) return {
    narrative:d.duelTxt,summary:'与人动手一场',scene:{location:d.place,unresolved:[]},check:null,
    playerChanges:{attributes:{},fame:{声望:2,恶名:0},money:0,skills:{},artsAdd:[],artsTrain:[{name:d.art.name,level:2}],statusAdd:[],statusRemove:[],itemsAdd:{},itemsRemove:[]},
    npcUpdates:[],newNpcs:[],npcEvents:[],rumors:['有人动了手'],
    newVendettas:[],questUpdates:[],newQuests:[],rankingUpdates:[],factionUpdates:[],duel:null,
    options:[{text:'就地歇口气',hint:'',type:'rest',months:1},{text:'回去复命',hint:'',type:'normal',months:2}],
    gameOver:false,ending:null};
  if(/【玩家本回合行动】与.{1,10}谈过之后/.test(prompt)){ aftNo++; return {
    narrative:'话头刚落，风还没停。\n他把那袋钱往你怀里一塞，转身进了屋。',summary:'谈完之后',
    scene:{location:d.place,unresolved:['父亲的死因']},check:null,
    playerChanges:{attributes:{},fame:{声望:0,恶名:0},money:0,skills:{},artsAdd:[],artsTrain:[],statusAdd:[],statusRemove:[],itemsAdd:{},itemsRemove:[]},
    npcUpdates:[],newNpcs:[],npcEvents:[],rumors:[],newVendettas:[],questUpdates:[],newQuests:[],
    rankingUpdates:[],rankingAdd:[],factionUpdates:[],duel:null,
    options:[{text:aftVary(0),hint:'',type:'normal',months:1},{text:aftVary(1),hint:'',type:'normal',months:1},{text:aftVary(2),hint:'',type:'rest',months:1}],
    gameOver:false,ending:null}; }
  if(prompt.includes('闭关参悟') || prompt.includes('请推演本回合')){
    turnNo++;
    return {
      narrative:'这一段日子过得飞快。\n'+d.name+'把那本旧卷翻了又翻。',summary:'第'+turnNo+'回的事',
      scene:{location:d.place,unresolved:['父亲的死因']},check:null,
      playerChanges:{age:null,attributes:{修为:2},hp:-5,fame:{声望:1,恶名:0},money:40,faction:null,contrib:12,
        skills:{},artsAdd:[],artsTrain:[{name:d.art.name,level:3}],personalityAdd:[],statusAdd:[],statusRemove:[],itemsAdd:{},itemsRemove:[]},
      npcUpdates:[],newNpcs:[],
      npcEvents:[d.npcs[0][0]+'出了趟门'],
      rumors:[{text:'万界榜要重排了'},{text:'轮枢传来：界门将开'}],
      newVendettas:turnNo===2?[{name:foe,reason:'你砸了他的场子',lethal:true}]:[],
      questUpdates:[{title:'查明父亲死因',progress:10,status:'进行中'}],newQuests:[],
      rankingUpdates:[],factionUpdates:[],duel:null,
      options:[{text:'继续修炼',hint:'',type:'rest',months:2},
               {text:'出门寻访线索',hint:'',type:'check',months:1,check:{attr:'谈吐',need:55}},
               {text:'找'+foe+'了断',hint:'凶险',type:'duel',months:1,duel:{opponent:foe,lethal:false}}],
      gameOver:false,ending:null};
  }
  if(prompt.includes('你现在扮演这个世界中的人物')) return {
    reply:'（她抬眼看你）「你脸色不好，这个拿去。」',innerThought:'他又在想他爹的事',mood:'关切',favor:4,
    attempt:{type:'求助',attr:'谈吐',need:40,total:60,success:true},revealSecret:false,endTalk:false,
    effects:{money:300,hp:25,info:'那边近来有埋伏'},summary:'说了几句'};
  if(prompt.includes('请把它压成一段')) return {text:'早年在'+d.place+'学艺。'};
  if(prompt.includes('墓志铭')) return {biography:'一生……',epitaph:'刀在人在',verdict:'性烈如火'};
  return {narrative:'（未知提示）',summary:'',options:[]};
}
function sse(obj){
  const s=JSON.stringify(obj), chunks=[];
  for(let i=0;i<s.length;i+=400) chunks.push(s.slice(i,i+400));
  return chunks.map(c=>'data: '+JSON.stringify({choices:[{delta:{content:c}}]})+'\n\n').join('')
    +'data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n';
}
module.exports.pickBody=pickBody; module.exports.sse=sse;

/* 站点服务：v3.4 起页面会去拿 sw.js、site.webmanifest、icon/*，
   全用 text/html 糊弄过去会让 service worker 注册报 MIME 错。按真文件发。 */
const _fs=require('fs'), _path=require('path');
const _ROOT=_path.join(__dirname,'..');
const _MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8',
  '.png':'image/png','.ico':'image/x-icon','.webp':'image/webp','.css':'text/css; charset=utf-8'};
function serve(q,r){
  let p=decodeURIComponent((q.url||'/').split('?')[0]);
  if(p==='/'||p==='') p='/index.html';
  const f=_path.join(_ROOT,p.replace(/^\/+/,''));
  if(!f.startsWith(_ROOT)||!_fs.existsSync(f)||_fs.statSync(f).isDirectory()){ r.writeHead(404); return r.end('404'); }
  const buf=_fs.readFileSync(f);
  // 按 GitHub Pages 的路数发缓存头：sw 装的时候才不会把整页再拉一遍
  r.writeHead(200,{'Content-Type':_MIME[_path.extname(f)]||'application/octet-stream',
    'Cache-Control':'max-age=600','ETag':'"'+buf.length+'-'+_fs.statSync(f).mtimeMs+'"'});
  r.end(buf);
}
module.exports.serve=serve;
