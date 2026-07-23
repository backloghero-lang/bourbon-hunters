import fs from "node:fs";
import path from "node:path";
import { buildCatalogTokenIndex } from "./catalog_identity.mjs";
import { MAX_RETAIL_USD, RETAIL_FILTER_VERSION, retailPriceUsd, retailRemovalReason } from "./catalog_retail_policy.mjs";

const root=path.resolve(import.meta.dirname,"..");
const catalogPath=path.join(root,"db","catalog","bottles.json");
const scanPath=path.join(root,"db","catalog","scan-index.json");
const qualityPath=path.join(root,"db","catalog","quality-report.json");
const filterReportPath=path.join(root,"db","catalog","retail-filter-report.json");

const catalog=JSON.parse(fs.readFileSync(catalogPath,"utf8"));
const scan=JSON.parse(fs.readFileSync(scanPath,"utf8"));
const quality=JSON.parse(fs.readFileSync(qualityPath,"utf8"));
const removals=[];
const retained=[];

for(const record of catalog.bottles||[]){
  const reason=retailRemovalReason(record);
  if(reason){
    removals.push({
      id:record.id,name:record.name,reason,source:record.source,
      completed_date:record.completed_date||null,price_usd:retailPriceUsd(record)||null
    });
  }else retained.push(record);
}

const retainedIds=new Set(retained.map((record)=>record.id));
const scanBottles=(scan.bottles||[]).filter((record)=>retainedIds.has(record.id));
const redirects=Object.fromEntries(Object.entries(catalog.id_redirects||{}).filter(([,targetId])=>retainedIds.has(targetId)));
const reasons=removals.reduce((counts,item)=>{
  counts[item.reason]=(counts[item.reason]||0)+1;
  return counts;
},{});
const updated=new Date().toISOString();
const meta={
  ...Object.fromEntries(Object.entries(catalog).filter(([key])=>key!=="bottles"&&key!=="id_redirects")),
  version:3,updated,count:retained.length,
  retail_filter_version:RETAIL_FILTER_VERSION,
  retail_max_usd:MAX_RETAIL_USD,
  retail_records_removed:removals.length,
  id_redirects:redirects
};
const updatedQuality={
  ...quality,
  ...Object.fromEntries(Object.entries(meta).filter(([key])=>key!=="id_redirects")),
  count:retained.length,
  selected_verified_price:retained.filter((record)=>record.catalog_status==="verified").length,
  selected_recognition_only:retained.filter((record)=>record.catalog_status!=="verified").length,
  retail_removal_reasons:reasons,
  missing:{
    proof:retained.filter((record)=>!record.proof).length,
    abv:retained.filter((record)=>!record.abv).length,
    distillery:retained.filter((record)=>!record.distillery).length,
    price:retained.filter((record)=>!record.price).length
  }
};

fs.writeFileSync(catalogPath,JSON.stringify({...meta,bottles:retained},null,2)+"\n");
fs.writeFileSync(scanPath,JSON.stringify({...meta,bottles:scanBottles,token_index:buildCatalogTokenIndex(scanBottles)})+"\n");
fs.writeFileSync(qualityPath,JSON.stringify(updatedQuality,null,2)+"\n");
fs.writeFileSync(filterReportPath,JSON.stringify({
  version:1,updated,policy:RETAIL_FILTER_VERSION,max_usd:MAX_RETAIL_USD,
  before:(catalog.bottles||[]).length,after:retained.length,removed:removals.length,reasons,records:removals
},null,2)+"\n");

console.log(JSON.stringify({
  ok:true,before:(catalog.bottles||[]).length,after:retained.length,
  removed:removals.length,reasons,report:filterReportPath
},null,2));
