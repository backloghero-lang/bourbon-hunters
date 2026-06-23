/* DramScan service worker — cache powloki aplikacji (dziala offline). */
const CACHE = "bourbon-hunters-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./db/bourbons.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  const req = e.request;
  // Zapytania do API (POST / Worker) zawsze z sieci — nie cache'ujemy.
  if (req.method !== "GET" || req.url.indexOf("workers.dev") !== -1 || req.url.indexOf("/api/") !== -1) return;
  // Powloka aplikacji: najpierw cache, potem siec (z aktualizacja cache).
  e.respondWith(
    caches.match(req).then(function(hit){
      const net = fetch(req).then(function(res){
        if (res && res.status===200 && res.type==="basic"){
          const copy = res.clone(); caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return hit; });
      return hit || net;
    })
  );
});
