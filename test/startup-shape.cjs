const assert=require('assert');
const {ctx,ev,reset}=require('./world-audit.cjs');
let count=0;const test=(name,fn)=>{reset();fn();console.log('✓ '+name);count++;};
function init(data){ctx.input=data;ev('applyInit(input,{realm:"樱洲"})');}
function player(extra={}){return {name:'测试主角',gender:'女',attributes:{修为:20},...extra};}
test('字符串物品、空值及原有属性',()=>{init({player:player({items:{其他:['旧书',null,3,{name:'护符',bonus:4}]}})});assert.equal(ev('S.player.items.其他[0].name'),'旧书');assert.equal(ev('S.player.items.其他.length'),2);assert.equal(ev('S.player.items.其他[0].from'),'樱洲');assert.equal(ev('S.player.items.其他[1].bonus'),4);});
test('单对象物品和文字功法',()=>{init({player:player({items:{医药:{name:'药丸',desc:'疗伤'}},arts:'剑术'})});assert.equal(ev('S.player.items.医药[0].name'),'药丸');assert.equal(ev('S.player.arts[0].name'),'剑术');});
test('物品总表给字符串或数组',()=>{for(const bag of ['旧书',['旧书']]){init({player:player({items:bag})});assert.equal(ev('S.player.items.其他[0].name'),'旧书');}});
test('属性、状态和性格格式变化',()=>{init({player:player({attributes:'一般',status:'疲惫',personality:'重义、果断'})});assert.equal(ev('S.player.status[0]'),'疲惫');assert.equal(ev('S.player.personality.length'),2);assert.equal(ev('S.player.attributes.修为'),0);});
test('NPC及任务单对象或文字',()=>{init({player:player(),npcs:'守卫',quests:{title:'寻找线索'}});assert.equal(ev('S.npcs[0].name'),'守卫');assert.equal(ev('S.quests[0].title'),'寻找线索');});
test('冻结输入不修改原始对象',()=>{ctx.input=Object.freeze({player:Object.freeze(player({items:{其他:['旧书']}}))});ev('applyInit(input,{realm:"樱洲"})');assert.equal(ctx.input.player.items.其他[0],'旧书');});
test('人物缺失中文错误并保留状态',()=>{const before=ev('S.player.name');ctx.input={player:'坏格式'};assert.throws(()=>ev('applyInit(input,{realm:"樱洲"})'),/有效的人物资料/);assert.equal(ev('S.player.name'),before);});
test('单对象榜单及字符串事件',()=>{ctx.data={ranking:{name:'剑客',修为:50},events:'边境争端'};ev('applyWorld(data)');assert.ok(ev('S.world.events.join("").includes("边境争端")'));});
test('返回整理后的开局选项',()=>{ctx.input={player:player(),options:['去练剑',null,{text:'拜访师父'}],opening:{text:'故事开始'}};ctx.result=ev('applyInit(input,{realm:"樱洲"})');assert.equal(ctx.result.options.length,2);assert.equal(ctx.result.options[0].text,'去练剑');});
console.log('PASS '+count+' startup checks');
