import fs from "node:fs";
import path from "node:path";
import { buildCatalogTokenIndex, dedupeCatalogRecords, identityAscii } from "./catalog_identity.mjs";

const root=path.resolve(import.meta.dirname,"..");
const catalogPath=path.join(root,"db","catalog","bottles.json");
const scanPath=path.join(root,"db","catalog","scan-index.json");
const reportPath=path.join(root,"db","catalog","quality-report.json");
const redirectsPath=path.join(root,"db","catalog","dedupe-redirects.json");

const catalog=JSON.parse(fs.readFileSync(catalogPath,"utf8"));
const previousReport=JSON.parse(fs.readFileSync(reportPath,"utf8"));
const result=dedupeCatalogRecords(catalog.bottles||[]);
const updated=new Date().toISOString();
const meta={
  ...Object.fromEntries(Object.entries(catalog).filter(([key])=>key!=="bottles")),
  version:2,
  updated,
  count:result.records.length,
  original_count:catalog.original_count||catalog.count||catalog.bottles.length,
  dedupe_version:"catalog-identity-safe-v1",
  duplicate_records_removed:result.removed,
  id_redirects:result.redirects
};

function scanRecord(record){
  const generic=new Set(["bourbon","whisky","whiskey","straight","bottled","bond","single","barrel","cask","proof","rye","scotch","malt","blend","blended","reserve","batch","finish","finished","the","and","for","with"]);
  const aliases=(record.aliases||[]).filter((alias)=>{
    const tokens=identityAscii(alias).split(/\s+/).filter((token)=>token.length>2);
    return tokens.length>=2&&tokens.some((token)=>!generic.has(token));
  });
  return {
    id:record.id,name:record.name,aliases,distillery:record.distillery,region:record.region,type:record.type,category:record.category,
    proof:record.proof,abv:record.abv,mashbill:record.mashbill,price:record.price,
    price_str:record.price_range||(record.price?`$${record.price}`:null),price_pln:record.price_pln||null,
    quality:record.quality,value:record.value,notes:record.notes,desc:record.profile?.pl?.general||record.desc,
    image:record.image||"",source:record.source,catalog_status:record.catalog_status
  };
}

const scanBottles=result.records.map(scanRecord);
const report={
  ...previousReport,
  ...Object.fromEntries(Object.entries(meta).filter(([key])=>key!=="id_redirects")),
  count:result.records.length,
  selected_verified_price:result.records.filter((record)=>record.catalog_status==="verified").length,
  selected_recognition_only:result.records.filter((record)=>record.catalog_status!=="verified").length,
  duplicate_groups_merged:result.groups.length,
  missing:{
    proof:result.records.filter((record)=>!record.proof).length,
    abv:result.records.filter((record)=>!record.abv).length,
    distillery:result.records.filter((record)=>!record.distillery).length,
    price:result.records.filter((record)=>!record.price).length
  }
};

fs.writeFileSync(catalogPath,JSON.stringify({...meta,bottles:result.records},null,2)+"\n");
fs.writeFileSync(scanPath,JSON.stringify({...meta,bottles:scanBottles,token_index:buildCatalogTokenIndex(scanBottles)})+"\n");
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n");
fs.writeFileSync(redirectsPath,JSON.stringify({version:1,updated,count:result.removed,redirects:result.redirects,groups:result.groups},null,2)+"\n");

console.log(JSON.stringify({
  ok:true,before:catalog.bottles.length,after:result.records.length,removed:result.removed,
  groups:result.groups.length,redirects:redirectsPath
},null,2));
