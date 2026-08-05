import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const modules=process.env.CODEX_NODE_MODULES||"C:/Users/masly/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.1/node_modules";
const require=createRequire(modules.replace(/\\/g,"/")+"/taxonomy-smoke-entry.js");
const { chromium }=require("playwright");
const chrome=process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe";
const target=process.env.BH_SMOKE_URL||"http://127.0.0.1:8765/index.html";
const output=path.resolve(import.meta.dirname,"..","artifacts");
fs.mkdirSync(output,{recursive:true});

const browser=await chromium.launch({headless:true,executablePath:chrome});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[];
page.on("pageerror",(error)=>errors.push("pageerror: "+error.message));
page.on("console",(message)=>{
  if(message.type()==="error" && !message.text().includes("Failed to load resource")) errors.push("console: "+message.text());
});
page.on("response",(response)=>{
  if(response.status()===404 && !response.url().endsWith("/favicon.ico")) errors.push("404: "+response.url());
});

await page.goto(target,{waitUntil:"domcontentloaded"});
await page.evaluate(()=>{
  document.getElementById("ageGate")?.classList.remove("show");
  document.getElementById("intro")?.remove();
});
await page.waitForFunction(()=>typeof DB!=="undefined" && DB.length>=250);

const homeCategories=await page.locator("#catGrid .cat").count();
if(homeCategories!==6) throw new Error(`Expected 6 home categories, got ${homeCategories}`);
const categoryCounters=await page.locator("#catGrid .cat .cnt").count();
if(categoryCounters!==0) throw new Error(`Home categories should not expose counts, got ${categoryCounters}`);
const whiskyMetaCount=await page.evaluate(()=>Number(BROWSE_META.families.whisky)||0);
if(whiskyMetaCount<1) throw new Error("Whisky metadata count should remain available for internal filtering");
await page.locator("#catGrid").scrollIntoViewIfNeeded();
await page.screenshot({path:path.join(output,"whisky-home-categories-mobile.png")});

await page.locator('.cat[data-family="whisky"]').click();
await page.waitForFunction(()=>typeof whiskyCatalogLoaded!=="undefined" && whiskyCatalogLoaded===true,{timeout:20000});
await page.waitForSelector('[data-explore-style="scotch"]');

const homeCounterAudit=await page.evaluate(()=>[...document.querySelectorAll("#catGrid .cat")].map((tile)=>{
  const family=tile.dataset.family||"";
  const style=tile.dataset.style||"";
  const hasCounter=!!tile.querySelector(".cnt");
  const actual=family==="whisky"
    ? DB.filter((bottle)=>bottleFamily(bottle)==="whisky").length
    : DB.filter((bottle)=>bottleFamily(bottle)==="bourbon"&&styleMatch(bottle,style)).length;
  return {family,style,hasCounter,actual};
}));
if(homeCounterAudit.some((item)=>item.hasCounter)) throw new Error(`Home category counts leaked into UI: ${JSON.stringify(homeCounterAudit)}`);

const lockedState=await page.evaluate(()=>({
  title:document.getElementById("exploreTitle")?.textContent,
  familyButtons:document.querySelectorAll("[data-explore-family]").length,
  styles:[...document.querySelectorAll("[data-explore-style]")].map((button)=>button.dataset.exploreStyle),
  visibleFamilies:[...document.querySelectorAll("#exploreGrid [data-id]")].slice(0,20).map((row)=>bottleFamily(DB.find((bottle)=>bottle.id===row.dataset.id)))
}));
if(lockedState.title!=="Whisky") throw new Error(`Unexpected locked title: ${lockedState.title}`);
if(lockedState.familyButtons!==0) throw new Error("Locked Whisky view should only show Whisky subfilters");
for(const required of ["scotch","irish","japanese","rye","american_malt"]){
  if(!lockedState.styles.includes(required)) throw new Error(`Missing Whisky filter: ${required}`);
}
if(lockedState.visibleFamilies.some((family)=>family!=="whisky")) throw new Error("Bourbon leaked into Whisky view");

await page.locator('[data-explore-style="scotch"]').click();
const scotchRows=await page.evaluate(()=>[...document.querySelectorAll("#exploreGrid [data-id]")].slice(0,30).map((row)=>{
  const bottle=DB.find((item)=>item.id===row.dataset.id);
  return bottleStyleKeys(bottle);
}));
if(scotchRows.some((keys)=>!keys.includes("scotch"))) throw new Error("Non-Scotch bottle leaked into Scotch filter");

const mobileDimensions=await page.evaluate(()=>({
  width:document.documentElement.clientWidth,
  scrollWidth:document.documentElement.scrollWidth
}));
if(mobileDimensions.scrollWidth>mobileDimensions.width+1) throw new Error(`Mobile overflow: ${JSON.stringify(mobileDimensions)}`);
await page.screenshot({path:path.join(output,"whisky-category-mobile.png")});

await page.setViewportSize({width:1280,height:900});
await page.screenshot({path:path.join(output,"whisky-category-desktop.png")});

const listFilterState=await page.evaluate(()=>{
  const bourbon=DB.find((bottle)=>bottleFamily(bottle)==="bourbon");
  const scotch=DB.find((bottle)=>bottleStyleKeys(bottle).includes("scotch"));
  OWNED=[bourbon.id,scotch.id];
  WL=[bourbon.id,scotch.id];
  renderCollection("owned");
  const collectionFamiliesBefore=[...document.querySelectorAll("#collectionStyleChips [data-coll-family]")].map((button)=>button.dataset.collFamily);
  collectionFamilies.owned="whisky";
  renderCollection("owned");
  const collectionIds=[...document.querySelectorAll("#collectionList [data-id]")].map((row)=>row.dataset.id);
  RECS=[
    normalizeRecommendation({id:"1",bottle_id:bourbon.id,bottle_name:bourbon.name,user_id:"1",rating:5,comment:"Bourbon"}),
    normalizeRecommendation({id:"2",bottle_id:scotch.id,bottle_name:scotch.name,user_id:"2",rating:5,comment:"Scotch"})
  ];
  renderRecommendationsView();
  const recommendationFamilies=[...document.querySelectorAll("#recommendationFilterChips [data-rec-family]")].map((button)=>button.dataset.recFamily);
  return {bourbonId:bourbon.id,scotchId:scotch.id,collectionFamiliesBefore,collectionIds,recommendationFamilies};
});
if(!listFilterState.collectionFamiliesBefore.includes("bourbon") || !listFilterState.collectionFamiliesBefore.includes("whisky")) throw new Error("Collection family filters are incomplete");
if(listFilterState.collectionIds.length!==1 || listFilterState.collectionIds[0]!==listFilterState.scotchId) throw new Error("Collection Whisky filter returned an invalid bottle");
if(!listFilterState.recommendationFamilies.includes("bourbon") || !listFilterState.recommendationFamilies.includes("whisky")) throw new Error("Recommendation family filters are incomplete");
await browser.close();

if(errors.length) throw new Error(errors.join("\n"));
console.log(JSON.stringify({ok:true,homeCategories,categoryCounters,whiskyMetaCount,homeCounterAudit,lockedState,mobileDimensions,listFilterState},null,2));
