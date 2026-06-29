/* Bourbon Hunters service worker - network-first dla aktualizacji aplikacji i bazy. */
const CACHE = "bourbon-hunters-v33";
const ASSETS = [
  "./",
  "./index.html",
  "./test-index.html",
  "./manifest.json",
  "./assets/intro/nowe intro.mp4",
  "./design/figma-assets/home-pack-v2/app-background-v3.jpg",
  "./design/figma-assets/home-pack-v2/home-header-v3.jpg",
  "./design/figma-assets/home-pack-v2/card-background-v1.jpg",
  "./design/figma-assets/home-pack-v2/collection-add.png",
  "./design/figma-assets/home-pack-v2/wishlist-barrel.png",
  "./design/figma-assets/home-pack-v2/rolling-barrel.png",
  "./design/figma-assets/home-pack-v2/small-batch.png",
  "./design/figma-assets/home-pack-v2/single-barrel.png",
  "./design/figma-assets/home-pack-v2/bottled-in-bond.png",
  "./design/figma-assets/home-pack-v2/barrel-proof.png",
  "./design/figma-assets/home-pack-v2/rye-whiskey.png",
  "./design/figma-assets/home-pack-v2/limited-edition.png",
  "./assets/bourbons/cutouts-test/buffalo-trace-bourbon-1.png",
  "./assets/bourbons/cutouts-test/blantons-original-single-barrel-bourbon-whiskey-700ml.png",
  "./assets/bourbons/cutouts-test/eagle-rare-10-year-kentucky-straight-bourbon-whiskey-700ml.png",
  "./assets/bourbons/cutouts-test/w-l-weller-700ml-12-year-bourbon.png",
  "./assets/bourbons/cutouts-test/woodford-reserve-bourbon.png",
  "./assets/bourbons/cutouts-test/woodford-reserve-double-oaked-bourbon.png",
  "./assets/bourbons/cutouts-test/jim-beam-white-label.png",
  "./assets/bourbons/cutouts-test/knob-creek-kentucky-straight-bourbon.png",
  "./assets/bourbons/cutouts-test/knob-creek-bourbon-12-year.png",
  "./assets/bourbons/cutouts-test/makers-mark-101-proof-bourbon-whisky.png",
  "./assets/bourbons/cutouts-test/basil-hayden-s-kentucky-straight-bourbon.png",
  "./assets/bourbons/cutouts-test/russels-reserve-10-year-bourbon.png",
  "./assets/bourbons/cutouts-test/austin-nichols-wild-turkey-kentucky-straight-bourbon-whiskey-70cl.png",
  "./assets/bourbons/cutouts-test/four-roses.png",
  "./assets/bourbons/cutouts-test/elijah-craig-small-batch-bourbon.png",
  "./assets/bourbons/cutouts-test/old-forester-1897-bottled-in-bond.png",
  "./assets/bourbons/cutouts-test/old-forester-1910-old-fine-whiskey-bourbon-whiskey.png",
  "./assets/bourbons/cutouts-test/1792-single-barrel-kentucky-straight-bourbon.png",
  "./assets/bourbons/cutouts-test/yellowstone-select-kentucky-straight-bourbon.png",
  "./assets/bourbons/cutouts-test/michters-bourbon.png",
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
