self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>{e.waitUntil((async()=>{try{const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)));}catch(_){ } try{await self.registration.unregister();}catch(_){ } const cs=await self.clients.matchAll();cs.forEach(c=>c.navigate(c.url));})());});
