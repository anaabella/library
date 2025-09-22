const CACHE='anna-v1',urls=['/','/index.html','/css/style.css','/js/app.js','/js/books.js','/js/sagas.js','/js/storage.js','/js/utils.js','/js/pwa.js','/images/icon-192.png','/images/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(urls)));});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
