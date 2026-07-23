import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const root=path.resolve(import.meta.dirname,"..");
const workerPath=path.join(root,"agent","worker.js");
const catalogPath=path.join(root,"db","catalog","scan-index.json");

let source=fs.readFileSync(workerPath,"utf8").replace("export default {","globalThis.__worker={");
source+="\nglobalThis.__scannerTest={applyScanCatalogOverrides,matchBottleWithEvidence};";
const context={
  console,fetch,Response,Request,Headers,URL,TextEncoder,TextDecoder,
  crypto:webcrypto,atob,btoa,setTimeout,clearTimeout
};
vm.runInNewContext(source,context,{filename:"worker.js"});

const scanner=context.__scannerTest;
const db=scanner.applyScanCatalogOverrides(JSON.parse(fs.readFileSync(catalogPath,"utf8")));
const norm=(value)=>String(value||"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
const resolveExpected=(id)=>db.id_redirects?.[id]||id;

function match(vision,ocr){
  return scanner.matchBottleWithEvidence(db,vision||{},ocr||{});
}

function assert(condition,message){
  if(!condition) throw new Error(message);
}

const fixtures=[
  {
    label:"Jack Daniel's Bonded",
    expected:"jack-daniel-s-bonded-119-43",
    vision:{name:"Jack Daniel's Bonded",confidence:.97},
    ocr:{brand:"Jack Daniel's",name:"Bonded",expression:"Tennessee Whiskey",proof:"100",abv:"50%",confidence:.97,raw_text:"JACK DANIEL'S BONDED TENNESSEE WHISKEY 100 PROOF"}
  },
  {
    label:"Jack Daniel's Single Barrel Select",
    expected:"jack-daniel-s-single-barrel-select-140-43",
    vision:{name:"Jack Daniel's Single Barrel Select",confidence:.97},
    ocr:{brand:"Jack Daniel's",name:"Single Barrel Select",expression:"Tennessee Whiskey",proof:"94",abv:"47%",confidence:.97,raw_text:"JACK DANIEL'S SINGLE BARREL SELECT TENNESSEE WHISKEY 94 PROOF"}
  },
  {
    label:"Knob Creek 9",
    expected:"knob-creek-9-year-old-100-proof-bourbon",
    vision:{name:"Knob Creek 9 Year Old Bourbon",confidence:.97},
    ocr:{brand:"Knob Creek",name:"9 Year Old",expression:"Kentucky Straight Bourbon Whiskey",age:"9 Years",proof:"100",abv:"50%",confidence:.97,raw_text:"KNOB CREEK KENTUCKY STRAIGHT BOURBON WHISKEY AGED 9 YEARS 100 PROOF"}
  },
  {
    label:"Woodford Reserve Malt",
    expected:"olcc-5211b",
    vision:{name:"Woodford Reserve Malt",confidence:.97},
    ocr:{brand:"Woodford Reserve",name:"Malt",expression:"Kentucky Straight Malt Whiskey",confidence:.97,raw_text:"WOODFORD RESERVE MALT KENTUCKY STRAIGHT MALT WHISKEY"}
  },
  {
    label:"Jack Daniel's Single Barrel Rye",
    expected:"jack-daniel-s-single-barrel-rye-142-43",
    vision:{name:"Jack Daniel's Single Barrel Rye",confidence:.97},
    ocr:{brand:"Jack Daniel's",name:"Single Barrel Rye",expression:"Tennessee Rye Whiskey",proof:"94",abv:"47%",confidence:.97,raw_text:"JACK DANIEL'S SINGLE BARREL RYE TENNESSEE RYE WHISKEY"}
  },
  {
    label:"OCR wins a Visual variant conflict",
    expected:"jack-daniel-s-single-barrel-select-140-43",
    vision:{name:"Jack Daniel's Single Barrel Rye",confidence:.88},
    ocr:{brand:"Jack Daniel's",name:"Single Barrel Select",expression:"Tennessee Whiskey",proof:"94",abv:"47%",confidence:.98,raw_text:"JACK DANIEL'S SINGLE BARREL SELECT TENNESSEE WHISKEY 94 PROOF"}
  }
];

const fixtureResults=fixtures.map((fixture)=>{
  const result=match(fixture.vision,fixture.ocr);
  const actual=result&&result.bottle&&result.bottle.id;
  const expected=resolveExpected(fixture.expected);
  assert(actual===expected,`${fixture.label}: expected ${expected}, got ${actual||"none"}`);
  assert(!result.ambiguous,`${fixture.label}: result is ambiguous`);
  return {label:fixture.label,id:actual,confidence:Number(result.dbConfidence.toFixed(3))};
});

const singleSource=match({name:"Maker's Mark 46 Kentucky Straight Bourbon Whisky",confidence:.95},{});
assert(singleSource&&singleSource.dbConfidence<=.85,`Single-source confidence must be capped, got ${singleSource&&singleSource.dbConfidence}`);

const counts={};
for(const bottle of db.bottles) counts[norm(bottle.name)]=(counts[norm(bottle.name)]||0)+1;
const eligible=db.bottles.filter((bottle)=>!bottle.scan_disabled&&counts[norm(bottle.name)]===1&&norm(bottle.name).split(" ").length>=2);
const sampleSize=Math.min(1000,eligible.length);
const sample=Array.from({length:sampleSize},(_,index)=>eligible[Math.floor(index*eligible.length/sampleSize)]);
let top1=0,top2=0,noMatch=0,ambiguous=0;
const misses=[];
for(const bottle of sample){
  const result=match(
    {name:bottle.name,confidence:.95},
    {name:bottle.name,proof:bottle.proof==null?"":String(bottle.proof),abv:bottle.abv==null?"":String(bottle.abv),category:bottle.category||bottle.type||"",confidence:.95,raw_text:bottle.name}
  );
  if(!result){ noMatch++; continue; }
  const ids=(result.candidates||[]).map((candidate)=>candidate.id);
  if(ids[0]===bottle.id) top1++;
  if(ids.slice(0,2).includes(bottle.id)) top2++;
  else if(misses.length<20) misses.push({expected:bottle.id,name:bottle.name,candidates:ids.slice(0,3)});
  if(result.ambiguous) ambiguous++;
}

const top1Rate=top1/sampleSize;
const top2Rate=top2/sampleSize;
assert(top1Rate>=.98,`Synthetic top-1 regression: ${(top1Rate*100).toFixed(1)}%`);
assert(top2Rate>=.99,`Synthetic top-2 regression: ${(top2Rate*100).toFixed(1)}%; misses=${JSON.stringify(misses)}`);

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
  single_source_confidence:Number(singleSource.dbConfidence.toFixed(3))
},null,2));
