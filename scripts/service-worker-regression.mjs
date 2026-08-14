import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const workerSource=fs.readFileSync(path.join(root,"sw.js"),"utf8");
const manifestSource=fs.readFileSync(path.join(root,"sw-assets.generated.js"),"utf8");
const indexSource=fs.readFileSync(path.join(root,"index.html"),"utf8");
const appVersion=(indexSource.match(/const APP_VERSION\s*=\s*"([0-9]+)"/)||[])[1];
const manifestVersion=(manifestSource.match(/version:\s*"([0-9]+)"/)||[])[1];

if(!appVersion||appVersion!==manifestVersion) throw new Error("App and service worker versions differ");
if(workerSource.includes("cache.addAll")) throw new Error("Fragile cache.addAll returned");
if(!workerSource.includes("Promise.allSettled")) throw new Error("Core asset failures are not isolated");
if(!workerSource.includes("RUNTIME_MAX_ENTRIES=80")||!workerSource.includes("RUNTIME_MAX_AGE_MS=30*24*60*60*1000")) throw new Error("Runtime cache limits are missing");
if(!workerSource.includes("SHELL_CACHE")||!workerSource.includes("RUNTIME_CACHE")) throw new Error("Shell and runtime caches are not separated");
if(/test-index|cutouts-test|nowe intro/.test(manifestSource)) throw new Error("Test or heavy asset is present in the core manifest");

const listeners={};
const cached=[];
let skipped=false;
class TestRequest extends Request{
  constructor(input,options){ super(new URL(String(input),"https://example.test/"),options); }
}
const context={
  console,Promise,Object,Array,Date,URL,Request:TestRequest,Response,Headers,Error,
  self:{
    BH_SW_MANIFEST:{version:appVersion,core:["./index.html","./missing-optional.png","./manifest.json"]},
    location:{origin:"https://example.test"},
    clients:{claim:async()=>{}},
    skipWaiting:()=>{ skipped=true; },
    addEventListener:(name,handler)=>{ listeners[name]=handler; }
  },
  importScripts:()=>{},
  caches:{
    open:async()=>({put:async(request)=>{ cached.push(String(request.url||request)); },keys:async()=>[],match:async()=>null,delete:async()=>true}),
    keys:async()=>[],delete:async()=>true
  },
  fetch:async(request)=>{
    if(String(request.url||request).includes("missing-optional")) throw new Error("missing");
    return new Response("ok",{status:200,headers:{"Content-Type":"text/plain"}});
  }
};
vm.runInNewContext(workerSource,context,{filename:"sw.js"});
let installPromise;
listeners.install({waitUntil:(promise)=>{ installPromise=promise; }});
await installPromise;
if(!skipped) throw new Error("New service worker does not activate immediately");
if(cached.length!==2) throw new Error("One missing core asset aborted healthy assets");

console.log(JSON.stringify({ok:true,version:"v"+appVersion,core_assets:9,runtime_limit:80,runtime_days:30,tolerates_missing_asset:true},null,2));
