import { chromium,browserLaunchOptions } from "./playwright-runtime.mjs";

const target=process.env.BH_MOBILE_SMOKE_URL||"http://127.0.0.1:8765/mobile-dist/index.html";
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
    headerWidth:document.querySelector(".topbar")?.getBoundingClientRect().width||0,
    renderedImages:[...document.images].filter((image)=>image.complete&&image.naturalWidth>0).length
  }
));
await browser.close();
if(failures.length) throw new Error("Mobile bundle has missing resources:\n"+failures.join("\n"));
if(state.version!=="132" || state.bottles!==200 || !state.nativeBridge || state.nativeMode) throw new Error("Mobile bundle runtime mismatch: "+JSON.stringify(state));
if(state.headerWidth<300 || state.renderedImages<1) throw new Error("Mobile bundle did not render: "+JSON.stringify(state));
console.log(JSON.stringify({ok:true,state},null,2));
