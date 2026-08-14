import { chromium,browserLaunchOptions } from "./playwright-runtime.mjs";
import fs from "node:fs";
import path from "node:path";

const target=process.env.BH_SMOKE_URL||"http://127.0.0.1:8765/index.html";
const bottleId="olcc-8257b";
const photoPath=path.resolve("assets/profile-badges/bottle.png");
const previewPath=path.resolve("assets/bourbons/clean/austin-nichols-wild-turkey-kentucky-straight-bourbon-whiskey-70cl.webp");

const browser=await chromium.launch(browserLaunchOptions());
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[];
const processedImage="data:image/webp;base64,"+fs.readFileSync(previewPath).toString("base64");
let cutoutRequest=null;
page.on("pageerror",(error)=>errors.push("pageerror: "+error.message));
page.on("console",(message)=>{
  if(message.type()==="error"&&!message.text().includes("Failed to load resource")) errors.push("console: "+message.text());
});
await page.route("https://bourbon-hunters.darekmaslyk.workers.dev/**",async(route)=>{
  const pathName=new URL(route.request().url()).pathname;
  if(pathName==="/catalog/local-cutout"){ await route.fallback(); return; }
  let body={ok:true};
  if(pathName==="/ratings") body={ratings:{}};
  else if(pathName==="/recommendations") body={recommendations:[]};
  else if(pathName==="/catalog/recent") body={bottles:[]};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
});
await page.route("**/catalog/local-cutout",async(route)=>{
  cutoutRequest=route.request().postDataJSON();
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,image:processedImage,mime:"image/webp",width:960,height:1280,quality_checked:true,pipeline_version:"local-bottle-cutout-v2-quality-gated"})});
});

async function openMissingBottle(){
  await page.waitForFunction((id)=>typeof bottleById==="function"&&!!bottleById(id),bottleId);
  await page.evaluate((id)=>{
    AGE_GATE_RUNTIME_OK=true;
    document.getElementById("ageGate")?.classList.remove("show");
    openDetail(id,false,true);
  },bottleId);
}

await page.goto(target,{waitUntil:"domcontentloaded"});
await page.evaluate((name)=>new Promise((resolve)=>{
  const request=indexedDB.deleteDatabase(name);
  request.onsuccess=request.onerror=request.onblocked=()=>resolve();
}),"bourbon-hunters-local-bottle-images-v1");
await page.reload({waitUntil:"domcontentloaded"});
await openMissingBottle();

const initial={
  mystery:await page.locator("#detailBody .dphoto .mystery-bottle").count(),
  add:await page.locator("[data-local-photo-add]").count()
};
if(initial.mystery!==1||initial.add!==1) throw new Error(`Missing-image state is incorrect: ${JSON.stringify(initial)}`);

const chooserPromise=page.waitForEvent("filechooser");
await page.locator("[data-local-photo-add]").click();
const chooser=await chooserPromise;
await chooser.setFiles(photoPath);
await page.locator("#localPhotoModal.show #localPhotoAccept:not([disabled])").waitFor();
const beforeAccept=await page.evaluate((id)=>!!LOCAL_BOTTLE_IMAGES[id],bottleId);
if(beforeAccept) throw new Error("Local image was saved before user confirmation");
await page.locator("#localPhotoAccept").click();
await page.waitForFunction((id)=>!!LOCAL_BOTTLE_IMAGES[id],bottleId);
if(!cutoutRequest||cutoutRequest.bottle_id!==bottleId||!cutoutRequest.bottle_name) throw new Error(`Cutout request is missing bottle context: ${JSON.stringify(cutoutRequest)}`);
const saveDiagnostics=await page.evaluate((id)=>({
  hasLocal:!!LOCAL_BOTTLE_IMAGES[id],
  hasRenderedImage:document.querySelector("#detailBody .dphoto img[data-bottle-image]")?.src.startsWith("blob:")||false,
  toast:document.getElementById("toast")?.textContent||"",
  stageHeight:Math.round(document.querySelector("#detailBody .dphoto")?.getBoundingClientRect().height||0),
  imageMaxHeight:getComputedStyle(document.querySelector("#detailBody .dphoto img[data-bottle-image]")).maxHeight
}),bottleId);
if(!saveDiagnostics.hasRenderedImage) throw new Error(`Local image was not rendered: ${JSON.stringify(saveDiagnostics)}; ${errors.join("; ")}`);
if(saveDiagnostics.stageHeight<500||saveDiagnostics.imageMaxHeight!=="98%") throw new Error(`Detail bottle is still too small: ${JSON.stringify(saveDiagnostics)}`);
if(process.env.BH_SMOKE_SCREENSHOT) await page.screenshot({path:process.env.BH_SMOKE_SCREENSHOT,fullPage:true});
const savedSrc=await page.locator("#detailBody .dphoto img[data-bottle-image]").getAttribute("src");
if(!savedSrc?.startsWith("blob:")) throw new Error("Saved local image does not use an object URL");

if(process.env.BH_SMOKE_SCREENSHOT_DESKTOP){
  await page.setViewportSize({width:1280,height:900});
  await page.evaluate((id)=>openDetail(id,false,true),bottleId);
  await page.screenshot({path:process.env.BH_SMOKE_SCREENSHOT_DESKTOP,fullPage:true});
}

await page.reload({waitUntil:"domcontentloaded"});
await openMissingBottle();
await page.waitForFunction(()=>document.querySelector("#detailBody .dphoto img[data-bottle-image]")?.src.startsWith("blob:"));
const persistedSrc=await page.locator("#detailBody .dphoto img[data-bottle-image]").getAttribute("src");
if(!persistedSrc?.startsWith("blob:")||persistedSrc===savedSrc) throw new Error("Local bottle blob did not reload through a fresh object URL");
const persistedBlob=await page.evaluate((id)=>openLocalBottleImageDb().then((db)=>new Promise((resolve,reject)=>{
  const request=db.transaction("images","readonly").objectStore("images").get(id);
  request.onsuccess=()=>{ const result=request.result; db.close(); resolve(!!(result&&result.blob instanceof Blob&&!result.data_url)); };
  request.onerror=()=>{ db.close(); reject(request.error); };
})),bottleId);
if(!persistedBlob) throw new Error("IndexedDB did not persist the local photo as a Blob");

await page.locator("[data-local-photo-remove]").click();
await page.waitForFunction(()=>!!document.querySelector("#detailBody .dphoto .mystery-bottle"));
const finalMystery=await page.locator("#detailBody .dphoto .mystery-bottle").count();
if(finalMystery!==1) throw new Error("Mystery bottle did not return after local image removal");
if(errors.length) throw new Error(errors.join("\n"));

await browser.close();
console.log(JSON.stringify({
  ok:true,
  bottle_id:bottleId,
  initial,
  cutoutContext:{bottle_id:cutoutRequest.bottle_id,bottle_name:cutoutRequest.bottle_name},
  saveDiagnostics,
  persisted:true,
  removed:true
},null,2));
