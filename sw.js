/* Bourbon Hunters service worker - lekka powloka i ograniczony cache runtime. */
importScripts("./sw-assets.generated.js");

const SW_MANIFEST=self.BH_SW_MANIFEST||{version:"0",core:[]};
const SHELL_CACHE="bourbon-hunters-shell-v"+SW_MANIFEST.version;
const RUNTIME_CACHE="bourbon-hunters-runtime-v"+SW_MANIFEST.version;
const ACTIVE_CACHES=[SHELL_CACHE,RUNTIME_CACHE];
const CORE_ASSETS=Array.isArray(SW_MANIFEST.core)?SW_MANIFEST.core:[];
const RUNTIME_MAX_ENTRIES=80;
const RUNTIME_MAX_AGE_MS=30*24*60*60*1000;
const CACHE_TIME_HEADER="x-bh-cached-at";

async function cacheCoreAssets(){
  const cache=await caches.open(SHELL_CACHE);
  await Promise.allSettled(CORE_ASSETS.map(async function(path){
    const request=new Request(path,{cache:"reload"});
    const response=await fetch(request);
    if(!response.ok) throw new Error("core_asset_"+response.status);
    await cache.put(request,response);
  }));
}

self.addEventListener("install",function(event){
  self.skipWaiting();
  event.waitUntil(cacheCoreAssets());
});

self.addEventListener("activate",function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(key){
        return key.indexOf("bourbon-hunters-")===0&&ACTIVE_CACHES.indexOf(key)<0;
      }).map(function(key){ return caches.delete(key); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function cacheableResponse(response){
  return !!(response&&response.status===200&&response.type==="basic");
}

function stampedResponse(response){
  const headers=new Headers(response.headers);
  headers.set(CACHE_TIME_HEADER,String(Date.now()));
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:headers});
}

async function pruneRuntimeCache(){
  const cache=await caches.open(RUNTIME_CACHE);
  const requests=await cache.keys();
  const now=Date.now();
  const live=[];
  for(const request of requests){
    const response=await cache.match(request);
    const cachedAt=Number(response&&response.headers.get(CACHE_TIME_HEADER))||0;
    if(!cachedAt||now-cachedAt>RUNTIME_MAX_AGE_MS){
      await cache.delete(request);
    }else{
      live.push({request:request,cachedAt:cachedAt});
    }
  }
  if(live.length>RUNTIME_MAX_ENTRIES){
    live.sort(function(a,b){ return a.cachedAt-b.cachedAt; });
    await Promise.all(live.slice(0,live.length-RUNTIME_MAX_ENTRIES).map(function(entry){ return cache.delete(entry.request); }));
  }
}

async function putRuntime(request,response){
  if(!cacheableResponse(response)) return;
  const cache=await caches.open(RUNTIME_CACHE);
  await cache.put(request,stampedResponse(response.clone()));
  await pruneRuntimeCache();
}

async function runtimeMatch(request){
  const cache=await caches.open(RUNTIME_CACHE);
  const response=await cache.match(request);
  if(!response) return null;
  const cachedAt=Number(response.headers.get(CACHE_TIME_HEADER))||0;
  if(!cachedAt||Date.now()-cachedAt>RUNTIME_MAX_AGE_MS){
    await cache.delete(request);
    return null;
  }
  return response;
}

function shouldNetworkFirst(request,url){
  return request.mode==="navigate" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/spirit-taxonomy.js") || url.pathname.indexOf("/db/")!==-1;
}

function shouldStoreRuntime(request){
  return request.destination!=="video"&&request.destination!=="audio";
}

async function networkFirst(request,event){
  try{
    const response=await fetch(request);
    if(shouldStoreRuntime(request)) event.waitUntil(putRuntime(request,response).catch(function(){}));
    return response;
  }catch(error){
    const runtime=await runtimeMatch(request);
    if(runtime) return runtime;
    const shell=await caches.open(SHELL_CACHE);
    const exact=await shell.match(request);
    if(exact) return exact;
    if(request.mode==="navigate") return (await shell.match("./index.html"))||(await shell.match("./"));
    throw error;
  }
}

async function cacheFirst(request,event){
  const shell=await caches.open(SHELL_CACHE);
  const shellHit=await shell.match(request);
  if(shellHit) return shellHit;
  const runtime=await runtimeMatch(request);
  if(runtime) return runtime;
  const response=await fetch(request);
  if(shouldStoreRuntime(request)) event.waitUntil(putRuntime(request,response).catch(function(){}));
  return response;
}

self.addEventListener("fetch",function(event){
  const request=event.request;
  if(request.method!=="GET") return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin || url.pathname.indexOf("/api/")!==-1) return;
  event.respondWith(shouldNetworkFirst(request,url)?networkFirst(request,event):cacheFirst(request,event));
});
