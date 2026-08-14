import { chromium,browserLaunchOptions } from "./playwright-runtime.mjs";
const target=process.env.BH_SMOKE_URL||"http://127.0.0.1:8765/index.html";
const articles=Array.from({length:4},(_,index)=>({
  id:"news-"+index,
  title:"Whisky article "+(index+1),
  excerpt_pl:"Krotkie podsumowanie najwazniejszych informacji.",
  excerpt_en:"A concise summary of the most useful information.",
  image_url:"https://cdn.example.test/whisky-"+index+".jpg",
  url:"https://whiskyadvocate.com/News",
  source_name:"Whisky Advocate",
  published_at:"2026-07-"+String(20+index).padStart(2,"0")+"T10:00:00Z"
}));

const browser=await chromium.launch(browserLaunchOptions());
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true});
const errors=[];
let newsAuthHeader="";
let thumbnailRequests=0;
const thumbnailPixel=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64");
page.on("pageerror",(error)=>errors.push("pageerror: "+error.message));
page.on("console",(message)=>{
  if(message.type()==="error"&&!message.text().includes("Failed to load resource")) errors.push("console: "+message.text());
});
await page.route("**/news?*",async(route)=>{
  newsAuthHeader=route.request().headers().authorization||"";
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({articles,news_ready:true})});
});
await page.route("**/news/image/*",async(route)=>{
  thumbnailRequests++;
  if(route.request().url().endsWith("/news-1")){
    await route.fulfill({status:404,contentType:"application/json",body:'{"error":"image_unavailable"}'});
    return;
  }
  await route.fulfill({status:200,contentType:"image/png",body:thumbnailPixel});
});
await page.route("**/catalog/recent?*",(route)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({bottles:[],catalog_ready:true})}));
await page.route("**/recommendations?*",(route)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({recommendations:[],recommendations_ready:true})}));
await page.route("**/ratings?*",(route)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ratings:{}})}));
await page.goto(target,{waitUntil:"domcontentloaded"});
await page.evaluate(()=>{
  AGE_GATE_RUNTIME_OK=true;
  document.getElementById("ageGate")?.classList.remove("show");
});
await page.locator("#homeNewsList [data-news-auth]").waitFor();
await page.locator("#homeNewsList [data-news-auth]").click();
await page.locator("#newsAuthModal.show").waitFor();
const guestDiagnostics={
  lockedCards:await page.locator("#homeNewsList .news-card").count(),
  modalTitle:await page.locator("#newsAuthTitle").textContent()
};
if(guestDiagnostics.lockedCards!==0) throw new Error("Guest can see news cards: "+JSON.stringify(guestDiagnostics));
await page.locator("#newsAuthClose").click();
await page.evaluate(()=>{
  AUTH_TOKEN="news-smoke-token";
  AUTH_USER={id:"news-smoke-user",email:"hunter@example.com",username:"Hunter"};
  localStorage.setItem(AUTH_TOKEN_KEY,AUTH_TOKEN);
  localStorage.setItem(AUTH_USER_KEY,JSON.stringify(AUTH_USER));
  renderHomeNews();
  fetchNews();
});
await page.locator("#homeNewsList .news-card").first().waitFor();
if(newsAuthHeader!=="Bearer news-smoke-token") throw new Error("News request is missing authentication: "+newsAuthHeader);
const thumbnailSrc=await page.locator("#homeNewsList .news-card img").first().getAttribute("src");
if(!thumbnailSrc || !thumbnailSrc.includes("/news/image/news-0")) throw new Error("News thumbnail does not use the Worker proxy: "+thumbnailSrc);
await page.locator("#homeNewsList .news-card img").first().evaluate((image)=>{
  if(image.complete && image.naturalWidth>0) return;
  return new Promise((resolve,reject)=>{
    image.addEventListener("load",resolve,{once:true});
    image.addEventListener("error",()=>reject(new Error("Thumbnail failed to load")),{once:true});
  });
});
if(thumbnailRequests<1) throw new Error("Worker thumbnail proxy was not requested");
await page.locator("#homeNewsList .news-card img").nth(1).evaluate((image)=>{
  if(image.complete && image.naturalWidth>0) return;
  return new Promise((resolve,reject)=>{
    image.addEventListener("load",resolve,{once:true});
    image.addEventListener("error",()=>reject(new Error("Fallback thumbnail failed to load")),{once:true});
  });
});
const fallbackSrc=await page.locator("#homeNewsList .news-card img").nth(1).getAttribute("src");
if(!fallbackSrc || !fallbackSrc.includes("assets/news/editorial-fallback-v1.jpg")) throw new Error("Broken news thumbnail did not use the local fallback: "+fallbackSrc);

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
console.log(JSON.stringify({ok:true,guestDiagnostics,diagnostics,articleCards,externalDiagnostics},null,2));
