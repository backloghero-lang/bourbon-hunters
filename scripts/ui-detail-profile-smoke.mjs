import { createRequire } from "node:module";

const modules=process.env.CODEX_NODE_MODULES||"C:/Users/masly/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.1/node_modules";
const require=createRequire(modules.replace(/\\/g,"/")+"/smoke-entry.js");
const { chromium }=require("playwright");
const chrome=process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe";
const target=process.env.BH_SMOKE_URL||"http://127.0.0.1:8765/index.html";
const bottleId="angel-s-envy-kentucky-straight-bourbon-finished-in-port-barrels";

const browser=await chromium.launch({headless:true,executablePath:chrome});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[];
page.on("pageerror",(error)=>errors.push("pageerror: "+error.message));
page.on("console",(message)=>{
  if(message.type()==="error"&&!message.text().includes("Failed to load resource")) errors.push("console: "+message.text());
});

await page.goto(target,{waitUntil:"domcontentloaded"});
await page.evaluate(()=>{
  AGE_GATE_RUNTIME_OK=true;
  document.getElementById("ageGate")?.classList.remove("show");
});
await page.waitForFunction((id)=>typeof bottleById==="function"&&!!bottleById(id),bottleId);
await page.evaluate((id)=>openDetail(id,false,true),bottleId);
await page.locator("#detailBody .dphoto img[data-bottle-image]").waitFor();
const detail=await page.evaluate((id)=>{
  const bottle=bottleById(id);
  const image=document.querySelector("#detailBody .dphoto img[data-bottle-image]");
  const rect=image.getBoundingClientRect();
  const listHtml=bottleImageHtml(bottle,true,bottle.name);
  return {
    source:image.getAttribute("src")||"",
    renderedHeight:Math.round(rect.height),
    renderedWidth:Math.round(rect.width),
    stageHeight:Math.round(document.querySelector("#detailBody .dphoto").getBoundingClientRect().height),
    listUsesThumb:listHtml.includes("assets/bourbons/list-thumbs/")
  };
},bottleId);
if(!detail.source.includes("assets/bourbons/runtime-100/")) throw new Error("Detail does not use the full image: "+JSON.stringify(detail));
if(detail.renderedHeight<480) throw new Error("Detail bottle is too small: "+JSON.stringify(detail));
if(!detail.listUsesThumb) throw new Error("List thumbnail source changed: "+JSON.stringify(detail));
if(process.env.BH_DETAIL_SCREENSHOT) await page.screenshot({path:process.env.BH_DETAIL_SCREENSHOT,fullPage:true});

await page.reload({waitUntil:"domcontentloaded"});
await page.evaluate(()=>{
  AGE_GATE_RUNTIME_OK=true;
  document.getElementById("ageGate")?.classList.remove("show");
  showView("profile");
});
const profile=await page.evaluate(()=>{
  const row=document.querySelector("#view-profile .profile-row");
  return {background:getComputedStyle(row).backgroundImage,rowHeight:Math.round(row.getBoundingClientRect().height)};
});
if(!profile.background.includes("profile-herringbone-burnt-v1.webp")) throw new Error("Profile wood texture is missing: "+JSON.stringify(profile));
if(process.env.BH_PROFILE_SCREENSHOT) await page.screenshot({path:process.env.BH_PROFILE_SCREENSHOT,fullPage:true});
if(errors.length) throw new Error(errors.join("\n"));

await browser.close();
console.log(JSON.stringify({ok:true,detail,profile},null,2));
