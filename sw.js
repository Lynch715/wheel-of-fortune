/* 命运之轮 · 离线缓存（规范 v3.4 第二节 D）
   整份 index.html 有两三兆，每次都从 GitHub Pages 拉一遍太慢。
   这里一律「先给缓存里的，再悄悄去拿新的」：第二次进来是本地的，秒开；
   后台拿到新版就通知页面，由玩家自己点刷新——不在他玩到一半的时候换掉脚下的地板。 */
const VER='mingyunzhilun-v1';
const SMALL=['./site.webmanifest','./favicon.ico','./icon/icon-192.png','./icon/icon-512.png','./icon/maskable-512.png','./icon/icon-180.png'];

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(VER);
    // 有一个拿不到就整批失败、离线直接没了，所以一个一个来，失败的跳过
    await Promise.all(SMALL.map(u=>c.add(u).catch(err=>console.warn('[sw] 跳过',u,err))));
    // 整页两三兆，这会儿刚下过一遍，再拉一次就是白花一倍流量。
    // force-cache 让它优先吃浏览器自己的 HTTP 缓存；真没有才走网络。
    await c.add(new Request('./',{cache:'force-cache'})).catch(err=>console.warn('[sw] 整页没缓上',err));
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys()) if(k!==VER) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message',e=>{ if(e.data==='skipWaiting') self.skipWaiting(); });

// 同源的 GET 才管；别人家的接口（模型那一路）一概放行
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==location.origin) return;
  const key=(req.mode==='navigate')?'./':req;
  e.respondWith((async()=>{
    const c=await caches.open(VER);
    const hit=await c.match(key,{ignoreSearch:req.mode==='navigate'});
    const net=fetch(req).then(res=>{
      if(res&&res.ok&&res.type==='basic') c.put(key,res.clone()).catch(()=>{});
      return res;
    }).catch(()=>null);
    if(hit){ e.waitUntil(net); return hit; }      // 缓存里有就先给，更新在后台走
    const res=await net;
    return res||new Response('离线了，而且这一份还没缓存过',{status:504,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  })());
});
