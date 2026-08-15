import {chromium,browserLaunchOptions} from "./playwright-runtime.mjs";

const target=process.env.BH_DOWNLOAD_SMOKE_URL||"http://127.0.0.1:8765/download.html";
const browser=await chromium.launch(browserLaunchOptions());
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[];
page.on("pageerror",(error)=>errors.push("pageerror: "+error.message));
page.on("console",(message)=>{ if(message.type()==="error") errors.push("console: "+message.text()); });

await page.goto(target,{waitUntil:"networkidle"});
const state=await page.evaluate(()=>(
  {
    title:document.querySelector("h1")?.textContent||"",
    button:document.querySelector(".download")?.textContent.trim()||"",
    href:document.querySelector(".download")?.href||"",
    imageWidth:document.querySelector(".brand")?.naturalWidth||0,
    width:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth
  }
));
if(process.env.BH_DOWNLOAD_SMOKE_SCREENSHOT) await page.screenshot({path:process.env.BH_DOWNLOAD_SMOKE_SCREENSHOT,fullPage:true});

if(errors.length) throw new Error(errors.join("\n"));
if(state.title!=="Bourbon Hunters"||state.button!=="Pobierz APK") throw new Error("Download call to action is missing");
if(!state.href.includes("/downloads/android?source=download-page")) throw new Error("Tracked APK URL is missing");
if(state.imageWidth<300) throw new Error("Brand image did not load");
if(state.scrollWidth>state.width+1) throw new Error("Mobile horizontal overflow: "+JSON.stringify(state));

await page.goto(target+"?source=linkedin",{waitUntil:"networkidle"});
const linkedinHref=await page.locator(".download").getAttribute("href");
if(!linkedinHref?.includes("/downloads/android?source=linkedin")) throw new Error("LinkedIn download attribution is missing");
await browser.close();

console.log(JSON.stringify({ok:true,state},null,2));
