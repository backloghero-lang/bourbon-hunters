/* Bourbon Hunters service worker - network-first dla aktualizacji aplikacji i bazy. */
const CACHE = "bourbon-hunters-v23";
const ASSETS = [
  "./",
  "./index.html",
  "./test-index.html",
  "./manifest.json",
  "./assets/intro/bourbon-hunters-intro.mp4",
  "./design/figma-assets/home-pack-v2/app-background-v2.jpg",
  "./design/figma-assets/home-pack-v2/home-header-v2.jpg",
  "./design/figma-assets/home-pack-v2/small-batch.png",
  "./design/figma-assets/home-pack-v2/single-barrel.png",
  "./design/figma-assets/home-pack-v2/bottled-in-bond.png",
  "./design/figma-assets/home-pack-v2/barrel-proof.png",
  "./design/figma-assets/home-pack-v2/rye-whiskey.png",
  "./design/figma-assets/home-pack-v2/limited-edition.png",
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

function shouldNetworkFirst(url){
  return url.endsWith("/") || url.indexOf("/index.html")!==-1 || url.indexOf("/test-index.html")!==-1 || url.indexOf("/db/bourbons.json")!==-1 || url.indexOf("/sw.js")!==-1;
}

self.addEventListener("fetch", function(e){
  const req = e.request;
  if (req.method !== "GET" || req.url.indexOf("workers.dev") !== -1 || req.url.indexOf("/api/") !== -1) return;

  if (shouldNetworkFirst(req.url)){
    e.respondWith(
      fetch(req).then(function(res){
        if (res && res.status===200 && res.type==="basic"){
          const copy=res.clone(); caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return caches.match(req); })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        if (res && res.status===200 && res.type==="basic"){
          const copy=res.clone(); caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
