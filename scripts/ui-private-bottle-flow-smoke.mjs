import { chromium,browserLaunchOptions } from "./playwright-runtime.mjs";
const target=process.env.BH_SMOKE_URL||"http://127.0.0.1:8765/index.html";

const browser=await chromium.launch(browserLaunchOptions());
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[];
page.on("pageerror",(error)=>errors.push("pageerror: "+error.message));
page.on("console",(message)=>{ if(message.type()==="error") errors.push("console: "+message.text()); });
page.on("response",(response)=>{ if(response.status()>=400) errors.push("response "+response.status()+": "+response.url()); });
await page.route("https://bourbon-hunters.darekmaslyk.workers.dev/**",async(route)=>{
  const pathname=new URL(route.request().url()).pathname;
  let body={};
  if(pathname==="/ratings") body={ratings:{}};
  else if(pathname==="/recommendations") body={recommendations:[]};
  else if(pathname==="/catalog/recent") body={items:[]};
  else if(pathname==="/news") body={articles:[],news_ready:true};
  else if(pathname==="/me/private-bottles"){
    const input=JSON.parse(route.request().postData()||"{}");
    body={ok:true,bottle:{
      id:"private-user-test",name:input.name,distillery:input.distillery||"",category:input.category||"Other",
      type:input.category||"Other",region:input.region||"",abv:input.abv?Number(input.abv):null,
      proof:input.proof?Number(input.proof):null,price_range:input.price_range||"",general:input.general_info||"",
      desc:input.general_info||"",nose:input.nose||"",taste:input.taste||"",finish:input.finish||"",
      image:"",source:"private_user",catalog_status:"private",private:true,owner_only:true
    }};
  }
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
});

await page.goto(target,{waitUntil:"domcontentloaded"});
await page.waitForTimeout(5200);
await page.evaluate(()=>{
  document.getElementById("ageGate").classList.remove("show");
  showView("scan");
  renderLowConfidence({candidate:"Test Hunter Reserve",reason:"brand_not_confirmed",visionConfidence:.92,dbConfidence:0,minConfidence:.8});
});
await page.locator("[data-private-add-start]").click();
await page.locator(".private-auth-gate").waitFor();
const gateActions=await page.locator(".private-auth-gate [data-private-auth]").evaluateAll((buttons)=>buttons.map((button)=>button.getAttribute("data-private-auth")).sort());
if(gateActions.join(",")!=="register,signin" || await page.locator(".private-auth-gate [data-scan-retry]").count()!==1){
  throw new Error("Free-account gate is missing required actions: "+JSON.stringify(gateActions));
}

await page.evaluate(()=>{
  saveAuth({token:"test-token",user:{id:"user-test",email:"test@example.com",username:"tester"}});
  renderLowConfidence({candidate:"Test Hunter Reserve",reason:"brand_not_confirmed",visionConfidence:.92,dbConfidence:0,minConfidence:.8});
});
await page.locator("[data-private-add-start]").click();
await page.locator("#privateBottleForm").waitFor();
await page.locator('#privateBottleForm [name="distillery"]').fill("Hunter Distillery");
await page.locator('#privateBottleForm [name="category"]').fill("Single Malt");
await page.locator('#privateBottleForm [name="abv"]').fill("46");
await page.locator('#privateBottleForm button[type="submit"]').click();
await page.waitForTimeout(1200);
if(!await page.locator('[data-private-edit="private-user-test"]').count()){
  const debug=await page.evaluate(()=>({view:currentView,scan:document.getElementById("scanResult").innerText,detail:document.getElementById("detailBody").innerText,owned:OWNED.slice(-3),ids:DB.slice(-3).map((item)=>item.id)}));
  throw new Error("Private detail was not rendered: "+JSON.stringify(debug)+"; console="+errors.join(" | "));
}

const result=await page.evaluate(()=>({
  detail:document.getElementById("detailBody").innerText,
  inCollection:OWNED.includes("private-user-test"),
  publicExploreText:document.getElementById("exploreGrid").innerText
}));
await page.evaluate(()=>{
  renderScan({id:"demo-known-no-image",scan_match_id:"demo-known-no-image",name:"Known Demo Bottle",category:"Bourbon",known_catalog:true,catalog_status:"demo",image:"",value:null},"rate");
});
const knownWithoutImage={
  addCollection:await page.locator('[data-add-scan-collection="demo-known-no-image"]').count(),
  addCatalog:await page.locator('[data-add-catalog]').count()
};
await browser.close();

if(errors.length) throw new Error(errors.join("\n"));
if(!result.detail.includes("Test Hunter Reserve")) throw new Error("Saved private bottle was not opened");
if(!result.inCollection) throw new Error("Saved private bottle was not added to collection");
if(knownWithoutImage.addCollection!==1 || knownWithoutImage.addCatalog!==0) throw new Error("Known catalog bottle without image entered the submission flow");
console.log(JSON.stringify({ok:true,gate:true,form:true,private_detail:true,collection:true,known_without_image:true},null,2));
