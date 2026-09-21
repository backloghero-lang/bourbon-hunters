import { chromium,browserLaunchOptions } from "./playwright-runtime.mjs";
import fs from "node:fs";
import path from "node:path";

const target=process.env.BH_MOBILE_SMOKE_URL||"http://127.0.0.1:8765/mobile-dist/index.html";
const root=path.resolve(import.meta.dirname,"..");
const appSource=fs.readFileSync(path.join(root,"index.html"),"utf8");
const appVersion=appSource.match(/const APP_VERSION = "([^"]+)"/)?.[1];
if(!appVersion) throw new Error("Application version missing from index.html");
const catalog=JSON.parse(fs.readFileSync(path.join(root,"db","catalog","demo-200.json"),"utf8"));
for(const bottle of catalog.bottles||[]){
  if(!bottle.image) throw new Error(`${bottle.name}: detail image path is missing`);
  if(!fs.existsSync(path.join(root,"mobile-dist",...String(bottle.image).split("/")))){
    throw new Error(`${bottle.name}: detail image is missing from the mobile bundle`);
  }
}
const browser=await chromium.launch(browserLaunchOptions());
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const failures=[];
page.on("requestfailed",(request)=>{
  const error=request.failure()?.errorText||"failed";
  if(error==="net::ERR_ABORTED" && new URL(request.url()).pathname.endsWith("/assets/intro/nowe%20intro.mp4")) return;
  failures.push(request.url()+" "+error);
});
page.on("response",(response)=>{
  if(response.url().startsWith(new URL(target).origin) && response.status()>=400) failures.push(response.status()+" "+response.url());
});
await page.route("https://bourbon-hunters.darekmaslyk.workers.dev/**",async(route)=>{
  const pathname=new URL(route.request().url()).pathname;
  let body={};
  if(pathname==="/ratings") body={ratings:{}};
  else if(pathname==="/recommendations") body={recommendations:[]};
  else if(pathname==="/catalog/recent") body={items:[]};
  else if(pathname==="/news") body={articles:[],news_ready:true};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
});
await page.goto(target,{waitUntil:"networkidle"});
await page.evaluate(()=>document.getElementById("ageGate")?.classList.remove("show"));
await page.waitForTimeout(500);
const state=await page.evaluate(()=>(
  {
    version:typeof APP_VERSION==="undefined"?"":APP_VERSION,
    bottles:typeof DB==="undefined"?0:DB.length,
    nativeBridge:Boolean(window.BH_NATIVE),
    nativeMode:Boolean(window.BH_NATIVE&&window.BH_NATIVE.isNative),
    fourRosesDetail:bottleById("four-roses")?.image||"",
    headerWidth:document.querySelector(".topbar")?.getBoundingClientRect().width||0,
    renderedImages:[...document.images].filter((image)=>image.complete&&image.naturalWidth>0).length
  }
));
const detailAudit=await page.evaluate(async()=>{
  const failures=[];
  for(const bottle of DB){
    openDetail(bottle.id,true,true);
    const image=document.querySelector("#detailBody .dphoto img[data-bottle-image]");
    if(!image){ failures.push(bottle.name+": missing image element"); continue; }
    if(!image.complete) await new Promise((resolve)=>{ image.addEventListener("load",resolve,{once:true}); image.addEventListener("error",resolve,{once:true}); setTimeout(resolve,1500); });
    const frame=image.closest(".dphoto").getBoundingClientRect();
    const rect=image.getBoundingClientRect();
    if(!image.naturalWidth || !image.naturalHeight) failures.push(bottle.name+": image did not load");
    if(rect.height/frame.height<0.9) failures.push(bottle.name+": image box is too small");
  }
  return {checked:DB.length,failures};
});
await browser.close();
if(failures.length) throw new Error("Mobile bundle has missing resources:\n"+failures.join("\n"));
if(state.version!==appVersion || state.bottles!==200 || !state.nativeBridge || state.nativeMode || !state.fourRosesDetail.includes("/detail-200/")) throw new Error("Mobile bundle runtime mismatch: "+JSON.stringify(state));
if(state.headerWidth<300 || state.renderedImages<1) throw new Error("Mobile bundle did not render: "+JSON.stringify(state));
if(detailAudit.checked!==200 || detailAudit.failures.length) throw new Error("Mobile detail image audit failed: "+JSON.stringify(detailAudit));
console.log(JSON.stringify({ok:true,state,detailAudit},null,2));
