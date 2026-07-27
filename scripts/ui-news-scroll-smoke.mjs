import { createRequire } from "node:module";

const modules=process.env.CODEX_NODE_MODULES||"C:/Users/masly/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.1/node_modules";
const require=createRequire(modules.replace(/\\/g,"/")+"/smoke-entry.js");
const { chromium }=require("playwright");
const chrome=process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe";
const target=process.env.BH_SMOKE_URL||"http://127.0.0.1:8765/index.html";
const articles=Array.from({length:4},(_,index)=>({
  id:"news-"+index,
  title:"Whisky article "+(index+1),
  excerpt_pl:"Krotkie podsumowanie najwazniejszych informacji.",
  excerpt_en:"A concise summary of the most useful information.",
  image_url:"",
  url:"https://whiskyadvocate.com/News",
  source_name:"Whisky Advocate",
  published_at:"2026-07-"+String(20+index).padStart(2,"0")+"T10:00:00Z"
}));

const browser=await chromium.launch({headless:true,executablePath:chrome});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true});
const errors=[];
page.on("pageerror",(error)=>errors.push("pageerror: "+error.message));
page.on("console",(message)=>{
  if(message.type()==="error"&&!message.text().includes("Failed to load resource")) errors.push("console: "+message.text());
});
await page.route("**/news?*",async(route)=>{
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({articles,news_ready:true})});
});
await page.goto(target,{waitUntil:"domcontentloaded"});
await page.evaluate(()=>{
  AGE_GATE_RUNTIME_OK=true;
  document.getElementById("ageGate")?.classList.remove("show");
});
await page.locator("#homeNewsList .news-card").first().waitFor();

const diagnostics=await page.evaluate(()=>{
  const scroller=document.getElementById("featuredRow");
  function touch(x,y){
    return new Touch({identifier:1,target:scroller,clientX:x,clientY:y,pageX:x,pageY:y,screenX:x,screenY:y,radiusX:2,radiusY:2,force:1});
  }
  scroller.dispatchEvent(new TouchEvent("touchstart",{bubbles:true,cancelable:true,touches:[touch(200,240)]}));
  const verticalAllowed=scroller.dispatchEvent(new TouchEvent("touchmove",{bubbles:true,cancelable:true,touches:[touch(196,170)]}));
  scroller.dispatchEvent(new TouchEvent("touchend",{bubbles:true,cancelable:true,touches:[]}));
  scroller.dispatchEvent(new TouchEvent("touchstart",{bubbles:true,cancelable:true,touches:[touch(250,240)]}));
  const horizontalAllowed=scroller.dispatchEvent(new TouchEvent("touchmove",{bubbles:true,cancelable:true,touches:[touch(170,237)]}));
  scroller.dispatchEvent(new TouchEvent("touchend",{bubbles:true,cancelable:true,touches:[]}));
  return {
    touchAction:getComputedStyle(scroller).touchAction,
    verticalAllowed,
    horizontalAllowed,
    homeCards:document.querySelectorAll("#homeNewsList .news-card").length
  };
});
if(diagnostics.touchAction!=="pan-y") throw new Error("Carousel does not permit vertical pan: "+JSON.stringify(diagnostics));
if(!diagnostics.verticalAllowed) throw new Error("Vertical gesture was cancelled: "+JSON.stringify(diagnostics));
if(diagnostics.horizontalAllowed) throw new Error("Horizontal carousel gesture was not captured: "+JSON.stringify(diagnostics));
if(diagnostics.homeCards!==3) throw new Error("Home should show exactly 3 news cards: "+JSON.stringify(diagnostics));
if(process.env.BH_SMOKE_SCREENSHOT) await page.screenshot({path:process.env.BH_SMOKE_SCREENSHOT,fullPage:true});

await page.evaluate(()=>showView("articles"));
await page.locator("#articlesList .news-card").first().waitFor();
const articleCards=await page.locator("#articlesList .news-card").count();
if(articleCards!==4) throw new Error("Articles view did not render the full feed");
await page.evaluate(()=>{
  window.__openedArticle="";
  window.open=(url)=>{
    window.__openedArticle=String(url||"");
    return {opener:null};
  };
});
await page.locator("#articlesList .news-card").first().click();
const externalDiagnostics=await page.evaluate(()=>({
  opened:window.__openedArticle,
  state:JSON.parse(sessionStorage.getItem("bh_external_return_v1")||"null")
}));
if(externalDiagnostics.opened!=="https://whiskyadvocate.com/News") throw new Error("Article did not open outside the current app view: "+JSON.stringify(externalDiagnostics));
if(!externalDiagnostics.state||externalDiagnostics.state.view!=="articles") throw new Error("Article return state was not saved: "+JSON.stringify(externalDiagnostics));
if(errors.length) throw new Error(errors.join("\n"));

await browser.close();
console.log(JSON.stringify({ok:true,diagnostics,articleCards,externalDiagnostics},null,2));
