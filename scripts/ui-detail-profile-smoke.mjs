import { chromium,browserLaunchOptions } from "./playwright-runtime.mjs";
const target=process.env.BH_SMOKE_URL||"http://127.0.0.1:8765/index.html";
const bottleId="jim-beam-101-22";

const browser=await chromium.launch(browserLaunchOptions());
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[];
page.on("pageerror",(error)=>errors.push("pageerror: "+error.message));
page.on("console",(message)=>{
  if(message.type()==="error"&&!message.text().includes("Failed to load resource")) errors.push("console: "+message.text());
});
await page.route("https://bourbon-hunters.darekmaslyk.workers.dev/**",async(route)=>{
  const path=new URL(route.request().url()).pathname;
  let body={ok:true};
  if(path==="/ratings") body={ratings:{}};
  else if(path==="/recommendations") body={recommendations:[]};
  else if(path==="/catalog/recent") body={bottles:[]};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
});

await page.goto(target,{waitUntil:"domcontentloaded"});
await page.evaluate(()=>{
  AGE_GATE_RUNTIME_OK=true;
  document.getElementById("ageGate")?.classList.remove("show");
});
await page.waitForFunction((id)=>typeof bottleById==="function"&&!!bottleById(id),bottleId);
await page.evaluate((id)=>openDetail(id,false,true),bottleId);
await page.waitForFunction(()=>{
  const image=document.querySelector("#detailBody .dphoto img[data-bottle-image]");
  if(!image?.complete||image.naturalWidth===0) return false;
  const rect=image.getBoundingClientRect();
  return rect.width>0&&rect.height>=480;
},{timeout:15000});
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
    listHasImage:listHtml.includes("data-bottle-image")&&listHtml.includes("jim-beam-white-label.png")
  };
},bottleId);
if(!detail.source.includes("assets/bourbons/runtime-100/")) throw new Error("Detail does not use the full image: "+JSON.stringify(detail));
if(detail.renderedHeight<480) throw new Error("Detail bottle is too small: "+JSON.stringify(detail));
if(!detail.listHasImage) throw new Error("List image is missing: "+JSON.stringify(detail));
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
if(!profile.background.includes("assets/brand/profile-herringbone-burnt-v1.webp")) throw new Error("Profile wood texture is missing: "+JSON.stringify(profile));
if(process.env.BH_PROFILE_SCREENSHOT) await page.screenshot({path:process.env.BH_PROFILE_SCREENSHOT,fullPage:true});
if(errors.length) throw new Error(errors.join("\n"));

await browser.close();
console.log(JSON.stringify({ok:true,detail,profile},null,2));
