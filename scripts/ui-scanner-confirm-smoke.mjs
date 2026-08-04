import { createRequire } from "node:module";

const modules=process.env.CODEX_NODE_MODULES||"C:/Users/masly/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.1/node_modules";
const require=createRequire(modules.replace(/\\/g,"/")+"/scanner-smoke-entry.js");
const { chromium }=require("playwright");
const chrome=process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe";
const target=process.env.BH_SMOKE_URL||"http://127.0.0.1:8765/index.html";
const bottleId="bulleit-bottled-in-bond-111-22";
const pixel="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xw4Z5QAAAABJRU5ErkJggg==";
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
    const body=request.postDataJSON();
    if(body.confirmed_id){
      confirmedRequests++;
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
        result:{
          id:bottleId,name:"Bulleit Bottled in Bond",type:"Bourbon",category:"Bottled in Bond",
          proof:100,abv:50,price_str:"$50-90",image:pixel,source:"scan_preview",
          temporary_scan_asset:true,catalog_asset_missing:true
        },
        mode:"rate",matched:bottleId,confidence:1
      })});
      return;
    }
  }
  if(url.pathname==="/recommendations"){
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({recommendations:[]})});
    return;
  }
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,ratings:{},bottles:[]})});
});

await page.goto(target,{waitUntil:"domcontentloaded"});
await page.waitForFunction(()=>Array.isArray(DB)&&DB.length>0);
await page.evaluate((value)=>{ window.__scannerSmokePixel=value; },pixel);
const migratedCollection=await page.evaluate(()=>OWNED.slice());
await page.evaluate((id)=>{
  document.getElementById("ageGate").classList.remove("show");
  showView("scan");
  imgData="a".repeat(240);
  imgMime="image/jpeg";
  renderScanConfirmation({
    scan_id:"scan-single",
    mode:"rate",
    scan_preview_image:window.__scannerSmokePixel,
    candidates:[{id:id,name:"Bulleit Bottled in Bond",confidence:.96,result:{id:id,name:"Bulleit Bottled in Bond",category:"Bottled in Bond",proof:100,abv:50}}]
  });
},bottleId);

const single={
  title:await page.locator(".scan-confirm h2").innerText(),
  cancel:await page.locator("[data-scan-cancel]").innerText(),
  confirm:await page.locator("[data-scan-confirm]").innerText(),
  candidates:await page.locator("[data-scan-candidate]").count(),
  category:await page.locator(".scan-candidate-type").innerText(),
  strength:await page.locator(".scan-candidate-strength").innerText(),
  image:await page.locator(".scan-candidate-media img").getAttribute("src")
};
if(process.env.BH_SMOKE_SCREENSHOT) await page.screenshot({path:process.env.BH_SMOKE_SCREENSHOT+"-single.png",fullPage:true});
await page.locator("[data-scan-confirm]").click();
await page.waitForSelector("#scanResult .dphoto img");
const detail=await page.evaluate(()=>({
  name:document.querySelector("#scanResult .name")?.textContent||"",
  image:document.querySelector("#scanResult .dphoto img")?.getAttribute("src")||"",
  addButtonClass:document.querySelector("#scanResult [data-add-catalog],#scanResult [data-add-scan-collection]")?.className||"",
  width:document.documentElement.clientWidth,
  scrollWidth:document.documentElement.scrollWidth
}));
if(process.env.BH_SMOKE_SCREENSHOT) await page.screenshot({path:process.env.BH_SMOKE_SCREENSHOT+"-detail.png",fullPage:true});

await page.evaluate((id)=>{
  renderScanConfirmation({
    scan_id:"scan-double",
    mode:"rate",
    scan_preview_image:window.__scannerSmokePixel,
    candidates:[
      {id:id,name:"Bulleit Bottled in Bond",confidence:.96,result:{id:id,name:"Bulleit Bottled in Bond",category:"Bottled in Bond",proof:100,abv:50}},
      {id:"bulleit-bourbon",name:"Bulleit Bourbon",confidence:.92,result:{id:"bulleit-bourbon",name:"Bulleit Bourbon",category:"Standard"}}
    ]
  });
},bottleId);
const multiple={
  title:await page.locator(".scan-confirm h2").innerText(),
  candidates:await page.locator("[data-scan-candidate]").count(),
  width:await page.evaluate(()=>document.documentElement.clientWidth),
  scrollWidth:await page.evaluate(()=>document.documentElement.scrollWidth)
};
if(process.env.BH_SMOKE_SCREENSHOT) await page.screenshot({path:process.env.BH_SMOKE_SCREENSHOT+"-multiple.png",fullPage:true});
await browser.close();

if(errors.length) throw new Error(errors.join("\n"));
if(!migratedCollection.includes("knob-creek-120-proof-9-year-single-barrel-reserve-bourbon") || !migratedCollection.includes("michters-single-barrel-10-year-old-bourbon")){
  throw new Error("Legacy collection IDs were not migrated: "+JSON.stringify(migratedCollection));
}
if(single.candidates!==1 || single.title!=="Czy to ta butelka?") throw new Error("Single candidate flow is incorrect: "+JSON.stringify(single));
if(!/Tak, to ta/.test(single.confirm) || !/spróbuj ponownie/i.test(single.cancel)) throw new Error("Single candidate actions are incorrect: "+JSON.stringify(single));
if(single.category!=="BOTTLED IN BOND" || !/100 proof.*50% ABV/i.test(single.strength)) throw new Error("Candidate facts are missing: "+JSON.stringify(single));
if(single.image!==pixel) throw new Error("Prepared cutout is missing before confirmation: "+JSON.stringify(single));
if(detail.name!=="Bulleit Bottled in Bond" || !detail.image.startsWith("data:image/png")) throw new Error("Confirmed detail has no prepared image: "+JSON.stringify(detail));
if(detail.image!==single.image) throw new Error("Confirmation did not reuse the prepared cutout");
if(confirmedRequests!==0) throw new Error("Confirmation sent a second scanner request");
if(!detail.addButtonClass.includes("btn-bottle")) throw new Error("Scanner add button is not bottle green: "+JSON.stringify(detail));
if(detail.scrollWidth>detail.width+1) throw new Error("Scanner detail has horizontal overflow: "+JSON.stringify(detail));
if(multiple.candidates!==2 || multiple.title!=="Czy to któraś z nich?") throw new Error("Two-candidate flow is incorrect: "+JSON.stringify(multiple));
if(multiple.scrollWidth>multiple.width+1) throw new Error("Two-candidate confirmation has horizontal overflow: "+JSON.stringify(multiple));

console.log(JSON.stringify({ok:true,migratedCollection,single,detail,multiple},null,2));
