import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const modules=process.env.CODEX_NODE_MODULES||"C:/Users/masly/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.1/node_modules";
const require=createRequire(modules.replace(/\\/g,"/")+"/scanner-smoke-entry.js");
const { chromium }=require("playwright");
const chrome=process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe";
const target=process.env.BH_SMOKE_URL||"http://127.0.0.1:8765/index.html";
const bottleId="eagle-rare-10-year-kentucky-straight-bourbon-whiskey-700ml";
const assetPath=path.resolve(import.meta.dirname,"..","assets","bourbons","clean","eagle-rare-10-year-kentucky-straight-bourbon-whiskey-700ml.webp");
const bottleImage="data:image/webp;base64,"+fs.readFileSync(assetPath).toString("base64");
let responseVariant="missing";
let scannerRequests=0;
let confirmedRequests=0;

const browser=await chromium.launch({headless:true,executablePath:chrome});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,locale:"pl-PL"});
const errors=[];
page.on("pageerror",(error)=>errors.push("pageerror: "+error.message));
page.on("console",(message)=>{ if(message.type()==="error") errors.push("console: "+message.text()); });
await page.addInitScript(()=>{
  localStorage.setItem("bh_collection",JSON.stringify([
    "knob-creek-single-barrel-select-bourbon-sdbb-5-korg-creek",
    "michters-single-barrel-10-year-old-bourbon-2017"
  ]));
});
await page.route("https://bourbon-hunters.darekmaslyk.workers.dev/**",async(route)=>{
  const request=route.request();
  const url=new URL(request.url());
  if(request.method()==="POST" && url.pathname==="/"){
    scannerRequests++;
    const body=request.postDataJSON();
    if(body.confirmed_id) confirmedRequests++;
    const missing=responseVariant==="missing";
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
      result:{
        id:bottleId,name:"Eagle Rare 10 Year",type:"Bourbon",category:"Kentucky Straight Bourbon",
        distillery:"Buffalo Trace Distillery",region:"Kentucky",mashbill:"Corn, rye and malted barley",
        proof:90,abv:45,price_str:"$45-70",quality:4,value:4,
        image:bottleImage,source:missing?"scan_preview":"baza",temporary_scan_asset:missing,
        catalog_asset_missing:missing,has_image:true,has_catalog_image:!missing
      },
      mode:"rate",matched:bottleId,confidence:.97
    })});
    return;
  }
  if(url.pathname==="/recommendations"){
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({recommendations:[]})});
    return;
  }
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,ratings:{},bottles:[]})});
});

await page.goto(target,{waitUntil:"domcontentloaded"});
await page.waitForFunction(()=>Array.isArray(DB)&&DB.length>0);
const migratedCollection=await page.evaluate(()=>OWNED.slice());

async function runScan(expectedSource){
  await page.evaluate(()=>{
    document.getElementById("ageGate").classList.remove("show");
    showView("scan");
    resetShot();
    imgData="a".repeat(240);
    imgMime="image/jpeg";
    scan("rate");
  });
  await page.waitForFunction((source)=>currentScanResult&&currentScanResult.source===source,expectedSource);
  await page.waitForSelector("#scanResult .dphoto img");
  await page.waitForTimeout(700);
  return page.evaluate(()=>(
    {
      name:document.querySelector("#scanResult .name")?.textContent||"",
      imageType:(document.querySelector("#scanResult .dphoto img")?.getAttribute("src")||"").slice(0,24),
      confirmationCards:document.querySelectorAll(".scan-confirm,[data-scan-confirm]").length,
      addCatalog:document.querySelectorAll("[data-add-catalog]").length,
      addCollection:document.querySelectorAll("[data-add-scan-collection]").length,
      actionButtons:document.querySelectorAll(".scan-result-actions .btn").length,
      scanButtonClass:document.querySelector("[data-scan-new]")?.className||"",
      scanButtonIcons:document.querySelectorAll("[data-scan-new] svg").length,
      actionColumns:getComputedStyle(document.querySelector(".scan-result-actions")).gridTemplateColumns,
      navBackground:getComputedStyle(document.getElementById("bottomNav")).backgroundImage,
      width:document.documentElement.clientWidth,
      scrollWidth:document.documentElement.scrollWidth
    }
  ));
}

const missing=await runScan("scan_preview");
if(process.env.BH_SMOKE_SCREENSHOT) await page.screenshot({path:process.env.BH_SMOKE_SCREENSHOT+"-direct-missing.png",fullPage:true});
responseVariant="catalog";
const catalog=await runScan("baza");
if(process.env.BH_SMOKE_SCREENSHOT) await page.screenshot({path:process.env.BH_SMOKE_SCREENSHOT+"-direct-catalog.png",fullPage:true});
await browser.close();

if(errors.length) throw new Error(errors.join("\n"));
if(!migratedCollection.includes("knob-creek-120-proof-9-year-single-barrel-reserve-bourbon") || !migratedCollection.includes("michters-single-barrel-10-year-old-bourbon")){
  throw new Error("Legacy collection IDs were not migrated: "+JSON.stringify(migratedCollection));
}
if(scannerRequests!==2 || confirmedRequests!==0) throw new Error(`Unexpected scanner requests: total=${scannerRequests}, confirmed=${confirmedRequests}`);
if(missing.confirmationCards!==0 || catalog.confirmationCards!==0) throw new Error("Removed confirmation screen is still rendered");
if(missing.addCatalog!==1 || missing.addCollection!==0) throw new Error("Missing catalog asset has incorrect action: "+JSON.stringify(missing));
if(catalog.addCatalog!==0 || catalog.addCollection!==1) throw new Error("Catalog bottle has incorrect action: "+JSON.stringify(catalog));
for(const state of [missing,catalog]){
  if(state.name!=="Eagle Rare 10 Year" || !state.imageType.startsWith("data:image/webp")) throw new Error("Direct result is incomplete: "+JSON.stringify(state));
  if(state.actionButtons!==2 || !state.scanButtonClass.includes("btn-bottle") || state.scanButtonIcons!==1) throw new Error("Result actions are incorrect: "+JSON.stringify(state));
  if(state.actionColumns.split(" ").length!==2) throw new Error("Result actions are not symmetrical columns: "+JSON.stringify(state));
  if(!state.navBackground.includes("profile-herringbone-burnt-v1.webp")) throw new Error("Bottom navigation has no wood texture");
  if(state.scrollWidth>state.width+1) throw new Error("Scanner result has horizontal overflow: "+JSON.stringify(state));
}

console.log(JSON.stringify({ok:true,migratedCollection,scannerRequests,missing,catalog},null,2));
