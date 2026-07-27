import { createRequire } from "node:module";

const modules=process.env.CODEX_NODE_MODULES||"C:/Users/masly/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.1/node_modules";
const require=createRequire(modules.replace(/\\/g,"/")+"/smoke-entry.js");
const { chromium }=require("playwright");
const chrome=process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe";
const target=process.env.BH_SMOKE_URL||"http://127.0.0.1:8765/index.html";

const browser=await chromium.launch({headless:true,executablePath:chrome});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[];
page.on("pageerror",(error)=>errors.push("pageerror: "+error.message));
page.on("console",(message)=>{ if(message.type()==="error") errors.push("console: "+message.text()); });
await page.route("**/admin/catalog/moderation",async(route)=>{
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({items:[]})});
});
await page.route("**/news?*",async(route)=>{
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({articles:[],news_ready:true})});
});
await page.goto(target,{waitUntil:"domcontentloaded"});
await page.waitForTimeout(1200);
await page.evaluate(()=>{
  AUTH_IS_ADMIN=true;
  renderAdminReport({
    scanner:{scans:12,users:3,top_choice_acceptance_proxy:80,alternate_choice_correction_proxy:20,avg_duration_ms:1400},
    activity:{users_total:5,catalog_additions:2},
    outcomes:[{outcome:"candidates_presented",count:12}],
    service_usage:[{stage:"visual_identification",model:"gemini",calls:12,total_tokens:300,avg_duration_ms:500}]
  });
  document.querySelectorAll(".view").forEach((view)=>view.classList.remove("active"));
  document.getElementById("view-admin-reports").classList.add("active");
  document.getElementById("ageGate").classList.remove("show");
});
await page.waitForTimeout(500);
const metrics=await page.locator(".admin-metric").count();
const moderation=await page.locator("#adminModerationBody").innerText();
const dimensions=await page.evaluate(()=>({
  width:document.documentElement.clientWidth,
  scrollWidth:document.documentElement.scrollWidth,
  reportWidth:document.getElementById("view-admin-reports").scrollWidth
}));
if(process.env.BH_SMOKE_SCREENSHOT) await page.screenshot({path:process.env.BH_SMOKE_SCREENSHOT,fullPage:true});
await browser.close();

if(errors.length) throw new Error(errors.join("\n"));
if(metrics!==8) throw new Error("Expected 8 admin metrics, got "+metrics);
if(dimensions.scrollWidth>dimensions.width+1) throw new Error("Mobile horizontal overflow: "+JSON.stringify(dimensions));
console.log(JSON.stringify({ok:true,metrics,moderation,dimensions},null,2));
