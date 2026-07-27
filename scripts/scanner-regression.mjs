import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const root=path.resolve(import.meta.dirname,"..");
const workerPath=path.join(root,"agent","worker.js");
const catalogPath=path.join(root,"db","catalog","scan-index.json");
const catalogSource=fs.readFileSync(catalogPath,"utf8");
const workerSource=fs.readFileSync(workerPath,"utf8");

for(const required of [
  'local-bottle-cutout-v2-quality-gated',
  '.transform({width:960,height:1280,fit:"pad"',
  '"bottle_cutout_qa"',
  'preview_error="cutout_quality"'
]){
  if(!workerSource.includes(required)) throw new Error(`Missing image-pipeline guard: ${required}`);
}

let source=workerSource.replace("export default {","globalThis.__worker={");
source+="\nglobalThis.__scannerTest={applyScanCatalogOverrides,matchBottleWithVisual};";
const context={
  console,
  fetch:async()=>new Response(catalogSource,{status:200,headers:{"Content-Type":"application/json"}}),
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
const confirmationResponse=await context.__worker.fetch(confirmationRequest,{IMAGES:imagePipeline},{waitUntil(){}});
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
  confirmed_cutout:{matched:confirmation.matched,temporary:confirmation.result.temporary_scan_asset}
},null,2));
