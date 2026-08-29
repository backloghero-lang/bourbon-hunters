import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const root=path.resolve(import.meta.dirname,"..");
const workerPath=path.join(root,"agent","worker.js");
const catalogPath=path.join(root,"db","catalog","scan-index.json");
const catalogSource=fs.readFileSync(catalogPath,"utf8");
const workerSource=fs.readFileSync(workerPath,"utf8");
let cutoutQualityAcceptable=true;

for(const required of [
  'local-bottle-cutout-v2-quality-gated',
  '.transform({width:960,height:1280,fit:"pad"',
  '"bottle_cutout_qa"',
  'preview_error="cutout_quality"',
  'scan_candidate_cutout',
  'catalog_not_found',
  'recognition_uncertain'
]){
  if(!workerSource.includes(required)) throw new Error(`Missing image-pipeline guard: ${required}`);
}

let source=workerSource.replace("export default {","globalThis.__worker={");
source+="\nglobalThis.__scannerTest={applyScanCatalogOverrides,matchBottleWithVisual};";
const context={
  console,
  fetch:async(url,options)=>{
    if(String(url).includes("generativelanguage.googleapis.com")){
      const body=JSON.parse(options&&options.body||"{}");
      const prompt=String(body.contents&&body.contents[0]&&body.contents[0].parts&&body.contents[0].parts[0]&&body.contents[0].parts[0].text||"");
      const result=prompt.includes("Ocen wyciety asset")
        ? {acceptable:cutoutQualityAcceptable,complete_bottle:cutoutQualityAcceptable,occlusion_present:!cutoutQualityAcceptable,segmentation_damage:!cutoutQualityAcceptable,centered:true,reason_code:cutoutQualityAcceptable?"ok":"hand_occlusion",confidence:.99}
        : {name:"Bulleit Bottled in Bond",confidence:.97,evidence:["label"],candidates:[]};
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(result)}]}}]}),{status:200,headers:{"Content-Type":"application/json"}});
    }
    return new Response(catalogSource,{status:200,headers:{"Content-Type":"application/json"}});
  },
  Response,Request,Headers,URL,TextEncoder,TextDecoder,Blob,
  crypto:webcrypto,atob,btoa,setTimeout,clearTimeout
};
vm.runInNewContext(source,context,{filename:"worker.js"});

const scanner=context.__scannerTest;
const db=scanner.applyScanCatalogOverrides(JSON.parse(fs.readFileSync(catalogPath,"utf8")));
const norm=(value)=>String(value||"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
const resolveExpected=(id)=>db.id_redirects?.[id]||id;

function match(vision){
  return scanner.matchBottleWithVisual(db,vision||{});
}

function assert(condition,message){
  if(!condition) throw new Error(message);
}

const fixtures=[
  {
    label:"Jack Daniel's Bonded",
    expected:"jack-daniel-s-bonded-119-43",
    vision:{name:"Jack Daniel's Bonded",confidence:.97,candidates:[]}
  },
  {
    label:"Jack Daniel's Single Barrel Select",
    expected:"jack-daniel-s-single-barrel-select-140-43",
    vision:{name:"Jack Daniel's Single Barrel Select",confidence:.97,candidates:[]}
  },
  {
    label:"Knob Creek 9",
    expected:"knob-creek-9-year-old-100-proof-bourbon",
    vision:{name:"Knob Creek 9 Year Old Bourbon",confidence:.97,candidates:[]}
  },
  {
    label:"Woodford Reserve Malt",
    expected:"olcc-5211b",
    vision:{name:"Woodford Reserve Malt",confidence:.97,candidates:[]}
  },
  {
    label:"Jack Daniel's Single Barrel Rye",
    expected:"jack-daniel-s-single-barrel-rye-142-43",
    vision:{name:"Jack Daniel's Single Barrel Rye",confidence:.97,candidates:[]}
  },
  {
    label:"Jack Daniel's Old No. 7",
    expected:"olcc-0146b",
    vision:{name:"Jack Daniel's Old No. 7",confidence:.97,candidates:[]}
  },
  {
    label:"Jim Beam White Label",
    expected:"jim-beam-white-label",
    vision:{name:"Jim Beam White Label",confidence:.97,candidates:[]}
  },
  {
    label:"Jim Beam Black",
    expected:"olcc-0133b",
    vision:{name:"Jim Beam Black",confidence:.97,candidates:[]}
  },
  {
    label:"Jim Beam Double Oak",
    expected:"olcc-3982b",
    vision:{name:"Jim Beam Double Oak",confidence:.97,candidates:[]}
  },
  {
    label:"Jim Beam Single Barrel",
    expected:"jim-beam-single-barrel",
    vision:{name:"Jim Beam Single Barrel",confidence:.97,candidates:[]}
  },
  {
    label:"Bushmills Original",
    expected:"bushmills-original-irish-whiskey",
    vision:{name:"Bushmills Original Irish Whiskey",confidence:.97,candidates:[]}
  },
  {
    label:"Bushmills Black Bush",
    expected:"bushmills-black-bush-irish-whiskey",
    vision:{name:"Bushmills Black Bush",confidence:.97,candidates:[]}
  },
  {
    label:"Bushmills 10 Year",
    expected:"bushmills-10-year-old-single-malt",
    vision:{name:"Bushmills 10 Year Old Single Malt",confidence:.97,candidates:[]}
  },
  {
    label:"Bushmills 12 Year",
    expected:"bushmills-12-year-old-single-malt",
    vision:{name:"Bushmills 12 Year Old Single Malt Irish Whiskey",confidence:.97,candidates:[]}
  },
  {
    label:"The Singleton 12 Year",
    expected:"olcc-6040b",
    vision:{name:"The Singleton of Dufftown 12 Year Old",confidence:.97,candidates:[]}
  },
  {
    label:"The Singleton 15 Year",
    expected:"olcc-4358b",
    vision:{name:"The Singleton 15 Year Old",confidence:.97,candidates:[]}
  },
  {
    label:"The Singleton Malt Master's Selection",
    expected:"the-singleton-malt-masters-selection",
    vision:{name:"The Singleton of Dufftown Malt Master's Selection",confidence:.97,candidates:[]}
  }
];

const fixtureResults=fixtures.map((fixture)=>{
  const result=match(fixture.vision);
  const actual=result&&result.bottle&&result.bottle.id;
  const expected=resolveExpected(fixture.expected);
  assert(actual===expected,`${fixture.label}: expected ${expected}, got ${actual||"none"}`);
  assert(!result.ambiguous,`${fixture.label}: result is ambiguous; candidates=${JSON.stringify((result.candidates||[]).slice(0,3))}`);
  return {label:fixture.label,id:actual,confidence:Number(result.dbConfidence.toFixed(3))};
});

const singleSource=match({name:"Maker's Mark 46 Kentucky Straight Bourbon Whisky",confidence:.95,candidates:[]});
assert(singleSource&&singleSource.dbConfidence>=.8,`Visual-only exact match must pass, got ${singleSource&&singleSource.dbConfidence}`);
const unsupportedBushmillsAge=match({name:"Bushmills 15 Year Old Single Malt Irish Whiskey",confidence:.97,candidates:[]});
assert(!unsupportedBushmillsAge||unsupportedBushmillsAge.dbConfidence<.8,`Unsupported Bushmills age must not become a confident catalog hit: ${unsupportedBushmillsAge&&unsupportedBushmillsAge.dbConfidence}`);

const counts={};
for(const bottle of db.bottles) counts[norm(bottle.name)]=(counts[norm(bottle.name)]||0)+1;
const eligible=db.bottles.filter((bottle)=>!bottle.scan_disabled&&counts[norm(bottle.name)]===1&&norm(bottle.name).split(" ").length>=2);
const sampleSize=Math.min(1000,eligible.length);
const sample=Array.from({length:sampleSize},(_,index)=>eligible[Math.floor(index*eligible.length/sampleSize)]);
let top1=0,top2=0,noMatch=0,ambiguous=0;
const misses=[];
for(const bottle of sample){
  const result=match({name:bottle.name,confidence:.95,candidates:[]});
  if(!result){ noMatch++; continue; }
  const ids=(result.candidates||[]).map((candidate)=>candidate.id);
  if(ids[0]===bottle.id) top1++;
  if(ids.slice(0,2).includes(bottle.id)) top2++;
  else if(misses.length<20) misses.push({expected:bottle.id,name:bottle.name,candidates:ids.slice(0,3)});
  if(result.ambiguous) ambiguous++;
}

const top1Rate=top1/sampleSize;
const top2Rate=top2/sampleSize;
assert(top1Rate>=.98,`Synthetic top-1 regression: ${(top1Rate*100).toFixed(1)}%; misses=${JSON.stringify(misses)}`);
assert(top2Rate>=.99,`Synthetic top-2 regression: ${(top2Rate*100).toFixed(1)}%; misses=${JSON.stringify(misses)}`);

const imagePipeline={
  input(){
    return {
      transform(){ return this; },
      output(){ return {response:()=>new Response(new Uint8Array([82,73,70,70,1,2,3,4]),{status:200,headers:{"Content-Type":"image/webp"}})}; }
    };
  }
};
function createBudgetDb(){
  const events=[];
  return {
    prepare(sql){
      let args=[];
      return {
        bind(...values){ args=values; return this; },
        async first(){
          if(sql.includes("sqlite_master")) return args[0]==="scanner_budget_events"?{name:"scanner_budget_events"}:null;
          if(sql.startsWith("SELECT COALESCE(SUM(CASE WHEN actor_hash=")){
            const [actorHash,ipHash,periodKey,operation]=args;
            return {
              actor_used:events.filter((row)=>row.periodKey===periodKey&&row.operation===operation&&row.actorHash===actorHash).length,
              ip_used:events.filter((row)=>row.periodKey===periodKey&&row.operation===operation&&row.ipHash===ipHash).length
            };
          }
          return null;
        },
        async run(){
          if(sql.startsWith("INSERT INTO scanner_budget_events")){
            const id=args[0],periodKey=args[1],actorType=args[2],actorHash=args[3],ipHash=args[4],operation=args[5],createdAt=args[6];
            const actorLimit=args[10],ipLimit=args[14];
            const actorUsed=events.filter((row)=>row.periodKey===periodKey&&row.operation===operation&&row.actorHash===actorHash).length;
            const ipUsed=events.filter((row)=>row.periodKey===periodKey&&row.operation===operation&&row.ipHash===ipHash).length;
            if(actorUsed>=Number(actorLimit)||ipUsed>=Number(ipLimit)) return {meta:{changes:0}};
            events.push({id,periodKey,actorType,actorHash,ipHash,operation,createdAt});
            return {meta:{changes:1}};
          }
          return {meta:{changes:0}};
        }
      };
    }
  };
}
const budgetDb=createBudgetDb();
const initialRequest=new Request("https://bourbon-hunters.darekmaslyk.workers.dev/",{
  method:"POST",
  headers:{"Content-Type":"application/json","Origin":"https://backloghero-lang.github.io"},
  body:JSON.stringify({
    image:btoa("candidate-bottle-photo".repeat(20)),
    mime:"image/jpeg",
    lang:"pl",
    mode:"rate",
    device_id:"scanner-regression"
  })
});
const initialResponse=await context.__worker.fetch(initialRequest,{DB:budgetDb,IMAGES:imagePipeline,GEMINI_API_KEY:"test"},{waitUntil(){}});
const initial=await initialResponse.json();
assert(initialResponse.status===200,`Initial cutout returned ${initialResponse.status}: ${JSON.stringify(initial)}`);
assert(initial.matched==="bulleit-bottled-in-bond-111-22",`Initial scan matched ${initial.matched||"nothing"}`);
assert(String(initial.result&&initial.result.image||"").startsWith("data:image/webp;base64,"),"Direct scan preview image is missing");
assert(initial.result&&initial.result.catalog_asset_missing===true,"Direct scan result is not marked for catalog completion");

cutoutQualityAcceptable=false;
const failedCutoutRequest=new Request("https://bourbon-hunters.darekmaslyk.workers.dev/",{
  method:"POST",
  headers:{"Content-Type":"application/json","Origin":"https://backloghero-lang.github.io"},
  body:JSON.stringify({
    image:btoa("candidate-bottle-photo-with-hand".repeat(20)),
    mime:"image/jpeg",
    lang:"pl",
    mode:"rate",
    device_id:"scanner-regression"
  })
});
const failedCutoutResponse=await context.__worker.fetch(failedCutoutRequest,{DB:budgetDb,IMAGES:imagePipeline,GEMINI_API_KEY:"test"},{waitUntil(){}});
const failedCutout=await failedCutoutResponse.json();
assert(failedCutoutResponse.status===200,`Failed cutout fallback returned ${failedCutoutResponse.status}: ${JSON.stringify(failedCutout)}`);
assert(failedCutout.matched==="bulleit-bottled-in-bond-111-22",`Failed cutout lost the recognized bottle: ${JSON.stringify(failedCutout)}`);
assert(failedCutout.result&&failedCutout.result.preview_error==="cutout_quality","Failed cutout reason is missing from a successful recognition");
assert(failedCutout.result&&failedCutout.result.catalog_asset_missing===true,"Failed cutout must keep the catalog asset marked as missing");
cutoutQualityAcceptable=true;

const confirmationRequest=new Request("https://bourbon-hunters.darekmaslyk.workers.dev/",{
  method:"POST",
  headers:{"Content-Type":"application/json","Origin":"https://backloghero-lang.github.io"},
  body:JSON.stringify({
    image:btoa("confirmed-bottle-photo".repeat(20)),
    mime:"image/jpeg",
    lang:"pl",
    mode:"rate",
    confirmed_id:"bulleit-bottled-in-bond-111-22",
    device_id:"scanner-regression"
  })
});
const confirmationResponse=await context.__worker.fetch(confirmationRequest,{DB:budgetDb,IMAGES:imagePipeline},{waitUntil(){}});
const confirmation=await confirmationResponse.json();
assert(confirmationResponse.status===200,`Confirmed cutout returned ${confirmationResponse.status}: ${JSON.stringify(confirmation)}`);
assert(confirmation.matched==="bulleit-bottled-in-bond-111-22",`Confirmed cutout matched ${confirmation.matched||"nothing"}`);
assert(String(confirmation.result&&confirmation.result.image||"").startsWith("data:image/webp;base64,"),"Confirmed cutout image is missing");
assert(confirmation.result&&confirmation.result.temporary_scan_asset===true,"Confirmed cutout is not marked as temporary");

console.log(JSON.stringify({
  ok:true,
  orchestrator:"scanner-regression-v1",
  fixtures:fixtureResults,
  synthetic:{
    sample:sampleSize,
    top1,
    top1_pct:Number((top1Rate*100).toFixed(1)),
    top2,
    top2_pct:Number((top2Rate*100).toFixed(1)),
    no_match:noMatch,
    ambiguous
  },
  misses,
  single_source_confidence:Number(singleSource.dbConfidence.toFixed(3)),
  direct_result:{matched:initial.matched,preview:true,catalog_asset_missing:initial.result.catalog_asset_missing},
  cutout_fallback:{matched:failedCutout.matched,preview_error:failedCutout.result.preview_error},
  confirmed_cutout:{matched:confirmation.matched,temporary:confirmation.result.temporary_scan_asset}
},null,2));
