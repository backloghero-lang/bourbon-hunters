import { chromium,browserLaunchOptions } from "./playwright-runtime.mjs";
const target=process.env.BH_SMOKE_URL||"http://127.0.0.1:8765/index.html";

const browser=await chromium.launch(browserLaunchOptions());
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[];
page.on("pageerror",(error)=>errors.push("pageerror: "+error.message));
page.on("console",(message)=>{ if(message.type()==="error") errors.push("console: "+message.text()); });
await page.route("https://bourbon-hunters.darekmaslyk.workers.dev/**",async(route)=>{
  const pathname=new URL(route.request().url()).pathname;
  let body={};
  if(pathname==="/ratings") body={ratings:{}};
  else if(pathname==="/recommendations") body={recommendations:[]};
  else if(pathname==="/catalog/recent") body={items:[]};
  else if(pathname==="/news") body={articles:[],news_ready:true};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
});
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
    activity:{users_total:5,catalog_additions:2,apk_downloads:9},
    outcomes:[{outcome:"candidates_presented",count:12}],
    service_usage:[{stage:"visual_identification",model:"gemini",calls:12,total_tokens:300,avg_duration_ms:500}]
  });
  renderAdminSystemHealth({
    scan_orchestrator_version:"visual-only-catalog-v9-model-resolver",
    scanner_primary_model:"gemini-3.5-flash-lite",
    scanner_fallback_model:"gemini-3.6-flash",
    scanner_ai_ready:true,
    scanner_model_discovery:true,
    scanner_mobile_foreground:true,
    scan_mode:"visual_only",
    scanner_budget_version:"d1-atomic-cost-budgets-v1",
    scanner_budget_schema:true,
    scanner_identify_daily_limit:5,
    scanner_cutout_daily_limit:10,
    scanner_analysis_daily_limit:3
  });
  document.querySelectorAll(".view").forEach((view)=>view.classList.remove("active"));
  document.getElementById("view-admin-reports").classList.add("active");
  document.getElementById("ageGate").classList.remove("show");
});
await page.waitForTimeout(500);
const metrics=await page.locator(".admin-metric").count();
const moderation=await page.locator("#adminModerationBody").innerText();
const systemHealth=await page.locator("#adminSystemHealth").innerText();
const technicalTables=await page.locator("#adminReportBody .admin-table").count();
const dimensions=await page.evaluate(()=>({
  width:document.documentElement.clientWidth,
  scrollWidth:document.documentElement.scrollWidth,
  reportWidth:document.getElementById("view-admin-reports").scrollWidth
}));
if(process.env.BH_SMOKE_SCREENSHOT) await page.screenshot({path:process.env.BH_SMOKE_SCREENSHOT,fullPage:true});
await browser.close();

if(errors.length) throw new Error(errors.join("\n"));
if(metrics!==9) throw new Error("Expected 9 admin metrics, got "+metrics);
if(!systemHealth.includes("v128")) throw new Error("Application version missing from system health");
if(/gemini|visual-only|model resolver/i.test(systemHealth)) throw new Error("Technical model details remain visible in system health");
if(technicalTables!==0) throw new Error("Scanner outcome or model tables remain visible");
if(dimensions.scrollWidth>dimensions.width+1) throw new Error("Mobile horizontal overflow: "+JSON.stringify(dimensions));
console.log(JSON.stringify({ok:true,metrics,moderation,systemHealth,technicalTables,dimensions},null,2));
