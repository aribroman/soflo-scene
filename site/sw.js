/* SoFlo Scene service worker: app shell offline, data network-first. */
const V='soflo-v9';
const SHELL=['./','styles.css','app.js','data/events.js','manifest.webmanifest','favicon.ico','og.png','icons/favicon-64.png','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin)return;
 const fresh=u.pathname.endsWith('/api/live')||u.pathname.endsWith('events.js')||r.mode==='navigate'||u.pathname.endsWith('app.js')||u.pathname.endsWith('styles.css');
 if(fresh){e.respondWith(fetch(r).then(res=>{if(res.ok&&!u.pathname.endsWith('/api/live')){const cp=res.clone();caches.open(V).then(c=>c.put(r.mode==='navigate'?'./':r,cp))}return res}).catch(()=>caches.match(r.mode==='navigate'?'./':r).then(m=>m||caches.match('./'))));return}
 e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}return res})))});
