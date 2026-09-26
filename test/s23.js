// S23 v4 头像接入（美术规范 v4.0 第 5 节）：两张图集、名人与头目按名认脸、桶按实际张数取、画像描述跟着脸走
// 用法：node test/s23.js（需 playwright；容器里用 PW_CHROME 指定 chromium）
const {chromium}=require('playwright');
const http=require('http');
const {pickBody,sse,serve}=require('./mock');
const srv=http.createServer(serve);
const fails=[],oks=[];
const ok=(n,c)=>{ (c?oks:fails).push(n); console.log((c?'  ✓ ':'  ✗ ')+n); };

(async()=>{
srv.listen(8983);
const br=await chromium.launch(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{});
const page=await (await br.newContext({viewport:{width:1400,height:900}})).newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
await page.route('**/chat/completions',async route=>{
  const b=JSON.parse(route.request().postData());
  await route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:sse(pickBody(b.messages[b.messages.length-1].content))});
});
await page.addInitScript(()=>{ localStorage.setItem('wanjie_cfg',JSON.stringify({base:'https://api.deepseek.com',key:'sk-test',model:'m',think:false})); });
await page.goto('http://localhost:8983/'); await page.waitForTimeout(400);

console.log('【图集】');
const a=await page.evaluate(()=>({
  av:AV_SLOTS.length, fm:FAME_SLOTS.length,
  noDesc:AV_SLOTS.concat(FAME_SLOTS).filter(k=>!AV_DESC[k]),
  dup:AV_SLOTS.filter(k=>FAME_SLOTS.indexOf(k)>=0),
  rows:[AV_ROWS,FAME_ROWS], x:AV_SLOTS.filter(k=>k[0]==='x').length,
  oldBoss:AV_SLOTS.filter(k=>/x_(boss_east|fox|fallen_angel|vampire|witch|oni|onryo|devourer)$/.test(k)),
  fameOnly:FAME_SLOTS.every(k=>/^[fb]_/.test(k)),
}));
ok('捏人+特型 124 张、名人+头目 137 张',a.av===124&&a.fm===137);
ok('每张都有画像描述',a.noDesc.length===0);
ok('两张图集不重名',a.dup.length===0);
ok('特型 18 张，旧的 8 类头目共用脸退役',a.x===18&&a.oldBoss.length===0);
ok('名人图集里只有 f_/b_',a.fameOnly);
ok('行数对得上',a.rows[0]===Math.ceil(124/10)&&a.rows[1]===Math.ceil(137/12));

console.log('【按名认脸】');
const f=await page.evaluate(()=>{
  const q=['太上老君','元始天尊','通天教主','观世音','观音菩萨','慈航','燃灯道人','燃灯古佛','金蝉子','齐天大圣','申公豹','玉藻前','妲己','吞噬者','蚀主','墟使','九尾狐','茨木童子','无天','伊达政宗','张三','李四娘'];
  const o={}; for(const n of q) o[n]=nameFace(n); return o;
});
ok('三清各一张',f['太上老君']==='f_laojun'&&f['元始天尊']==='f_yuanshi'&&f['通天教主']==='f_tongtian');
ok('观世音＝观音菩萨，慈航另一张',f['观世音']==='f_guanyin'&&f['观音菩萨']==='f_guanyin'&&f['慈航']==='f_cihang');
ok('燃灯两个阶段两张',f['燃灯道人']==='f_randeng_dao'&&f['燃灯古佛']==='f_randeng_fo');
ok('金蝉子借唐僧的脸、齐天大圣认孙悟空',f['金蝉子']==='f_tangseng'&&f['齐天大圣']==='f_wukong');
ok('跨界同名以幽墟为准（申公豹、玉藻前走 b_）',f['申公豹']==='b_shengongbao'&&f['玉藻前']==='b_tamamo');
ok('吞噬者与蚀主各一张',f['吞噬者']==='b_devourer'&&f['蚀主']==='b_shizhu');
ok('樱洲九尾狐不跟玉藻前撞',f['九尾狐']==='f_kyubi');
ok('幽墟非头目名人走 f_',f['茨木童子']==='f_ibaraki'&&f['无天']==='f_wutian');
ok('路人不认名人脸',f['张三']===null&&f['李四娘']===null);

const s=await page.evaluate(()=>{
  const r={};
  const fam={name:'太上老君',gender:'男',age:3000,identity:'太清一脉祖师，真仙',avatar:'d4m_01',portrait:'旧图的描述'};
  r.fam=avSlotOf(fam); r.famPor=npcPortrait(fam); r.famCell=(avCellStyle(r.fam)||'').indexOf(FAME_SHEET.slice(0,60))>=0;
  const pick={name:'太上老君',gender:'男',age:3000,avatar:'d4m_02',avatarPick:true};
  r.pick=avSlotOf(pick);
  const boss={name:'妲己',gender:'女',age:900,identity:'幽墟头目'};
  r.boss=avSlotOf(boss); r.bossPor=porOf(boss);
  r.dev=porOf({name:'吞噬者'})===POR_IMG.x_devourer;
  r.dummy=npcPortrait({name:'无名氏',gender:'女',age:20,realm:'西陆'});
  // 路人：一千个名字，看落桶
  const bad=[], seen={};
  for(let i=0;i<1500;i++){
    const realm=['东荒','西陆','樱洲','轮枢'][i%4], g=(i>>2)%2?'男':'女', age=[14,25,45,66][(i>>3)%4];
    const k=avPickSlot({name:'路人'+i+'号',gender:g,age,realm});
    if(!k||/^[fb]_/.test(k)) bad.push(k); else seen[k]=1;
  }
  r.bad=bad.length;
  r.unseen=AV_SLOTS.filter(k=>k[0]!=='x'&&!seen[k]);
  r.bucketSizes=[...new Set(AV_SLOTS.filter(k=>k[0]!=='x').map(k=>k.slice(0,3)))].map(b=>AV_SLOTS.filter(k=>k.indexOf(b+'_')===0).length);
  r.cellAv=(avCellStyle('d1f_01')||'').indexOf(AV_SHEET.slice(0,60))>=0;
  r.cellNone=avCellStyle('x_fox');
  return r;
});
ok('名人压过钉死的桶图',s.fam==='f_laojun');
ok('名人画像描述跟着新脸走，不用老存档里那句',s.famPor===await page.evaluate(()=>AV_DESC.f_laojun));
ok('名人从名人图集取格子',s.famCell);
ok('玩家手选的脸仍然压过一切',s.pick==='d4m_02');
ok('头目认 b_ 脸、不借特型立绘',s.boss==='b_daji'&&s.bossPor===null);
ok('吞噬者仍用它那张立绘',s.dev);
ok('没人给过描述的路人也按脸配描述',!!s.dummy);
ok('路人从不落到名人／头目脸',s.bad===0);
ok('每个桶 3 或 4 张，桶里每张都取得到',s.bucketSizes.every(n=>n===3||n===4)&&s.unseen.length===0);
ok('桶图从捏人图集取格子',s.cellAv);
ok('退役的格子取不到（退回墨影）',s.cellNone===null);


console.log('【捏人页】');
await page.click('#jieGrid .jiebtn[data-k="东荒"]');
const cells=async g=>{ await page.evaluate(g=>{ crSel.gender=g; renderAvatarPick(); },g); return page.$$eval('#crAvatar .cell:not(.auto)',x=>x.length); };
const nm=await cells('男'), nf=await cells('女'), nr=await cells('');
ok(`东荒男 ${nm} 张、女 ${nf} 张（12–16）`,nm>=12&&nm<=16&&nf>=12&&nf<=16);
ok('性别随机就男女都摆',nr===nm+nf);
const onlyAv=await page.$$eval('#crAvatar .cell[data-a]',x=>x.map(e=>e.dataset.a).filter(Boolean).every(k=>/^d[1-4][mf]_0\d$/.test(k)));
ok('捏人页不摆名人图',onlyAv);

console.log('【开局】');
await page.evaluate(()=>{ crSel.gender='男'; renderAvatarPick(); });
await page.click('#crStart');
await page.waitForSelector('#choices .opt',{timeout:25000});
const me=await page.evaluate(()=>{ const p={name:'孙悟空',gender:'男',age:20,realm:'东荒'}; const o=S.player; S.player=p; const k=avSlotOf(p); S.player=o; return k; });
ok('主角起名人的名字也不给名人脸',!/^[fb]_/.test(me||''));
const faces=await page.evaluate(()=>{
  const out=[];
  for(const n of ['太上老君','申公豹','阿步']) out.push(avatarFace({name:n,gender:'男',age:40,realm:'东荒'},'',64));
  return out;
});
ok('名人头像出图、不是墨影',faces[0].indexOf('FAME')<0&&faces[0].indexOf('svg+xml')<0);
await page.evaluate(()=>{ const d=document.createElement('div'); d.id='avtest'; d.style.cssText='position:fixed;left:0;top:0;z-index:99999;background:#e8e4da;display:flex;flex-wrap:wrap;gap:10px;padding:16px;width:760px';
  d.innerHTML=['太上老君','元始天尊','通天教主','孙悟空','申公豹','两面宿傩','吞噬者','安倍晴明','亚瑟王','梅林'].map(n=>avatarFace({name:n,gender:'男',age:40},'',64)).join('')
   +[['东荒','男',20],['西陆','女',30],['樱洲','女',15],['轮枢','男',60],['东荒','女',70],['西陆','男',16]].map(([r,g,a],i)=>avatarFace({name:'路人'+i,gender:g,age:a,realm:r},'',64)).join('');
  document.body.appendChild(d); });
await page.waitForTimeout(300);
await (await page.$('#avtest')).screenshot({path:require('path').join(__dirname,'s23-faces.png')});
ok('全程无页面报错',errs.length===0); if(errs.length) console.log(errs.slice(0,3));

await br.close(); srv.close();
console.log(`\n通过 ${oks.length} 项，失败 ${fails.length} 项`);
process.exit(fails.length?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
