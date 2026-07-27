import { createRequire } from "node:module";
import path from "node:path";

const modules=process.env.CODEX_NODE_MODULES||"C:/Users/masly/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.1/node_modules";
const require=createRequire(modules.replace(/\\/g,"/")+"/smoke-entry.js");
const { chromium }=require("playwright");
const chrome=process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe";
const target=process.env.BH_SMOKE_URL||"http://127.0.0.1:8765/index.html";
const bottleId="buffalo-trace-collaboration-e-h-taylor-bourbon-barrel-aged-bigfoot";
const photoPath=path.resolve("assets/profile-badges/bottle.png");

const browser=await chromium.launch({headless:true,executablePath:chrome});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[];
const processedImage="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X1y/AAAAAElFTkSuQmCC";
page.on("pageerror",(error)=>errors.push("pageerror: "+error.message));
page.on("console",(message)=>{
  if(message.type()==="error"&&!message.text().includes("Failed to load resource")) errors.push("console: "+message.text());
});
await page.route("**/catalog/local-cutout",async(route)=>{
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,image:processedImage,mime:"image/webp",width:960,height:1280})});
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
const saveDiagnostics=await page.evaluate((id)=>({
  hasLocal:!!LOCAL_BOTTLE_IMAGES[id],
  image:document.querySelector("#detailBody .dphoto img[data-bottle-image]")?.getAttribute("src")||"",
  toast:document.getElementById("toast")?.textContent||""
}),bottleId);
if(!saveDiagnostics.image.startsWith("data:image/")) throw new Error(`Local image was not rendered: ${JSON.stringify(saveDiagnostics)}; ${errors.join("; ")}`);
const savedSrc=await page.locator("#detailBody .dphoto img[data-bottle-image]").getAttribute("src");

await page.reload({waitUntil:"domcontentloaded"});
await openMissingBottle();
await page.waitForFunction(()=>document.querySelector("#detailBody .dphoto img[data-bottle-image]")?.src.startsWith("data:image/"));
const persistedSrc=await page.locator("#detailBody .dphoto img[data-bottle-image]").getAttribute("src");
if(savedSrc!==persistedSrc) throw new Error("Local bottle image did not persist after reload");

await page.locator("[data-local-photo-remove]").click();
await page.waitForFunction(()=>!!document.querySelector("#detailBody .dphoto .mystery-bottle"));
const finalMystery=await page.locator("#detailBody .dphoto .mystery-bottle").count();
if(finalMystery!==1) throw new Error("Mystery bottle did not return after local image removal");
if(errors.length) throw new Error(errors.join("\n"));

await browser.close();
console.log(JSON.stringify({ok:true,bottle_id:bottleId,initial,persisted:true,removed:true},null,2));
