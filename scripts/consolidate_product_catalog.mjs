import fs from "node:fs";
import path from "node:path";
import {
  buildCatalogTokenIndex,
  consolidateCatalogProducts,
  dedupeCatalogRecords,
  identityAscii
} from "./catalog_identity.mjs";
import {
  catalogQualityRemovalReason,
  MAX_RETAIL_PLN,
  MAX_RETAIL_USD,
  RETAIL_FILTER_VERSION,
  retailPackagingBundleReason,
  retailRemovalReason
} from "./catalog_retail_policy.mjs";

const root=path.resolve(import.meta.dirname,"..");
const basePath=path.join(root,"db","bourbons.json");
const catalogPath=path.join(root,"db","catalog","bottles.json");
const scanPath=path.join(root,"db","catalog","scan-index.json");
const qualityPath=path.join(root,"db","catalog","quality-report.json");
const redirectsPath=path.join(root,"db","catalog","dedupe-redirects.json");
const retailReportPath=path.join(root,"db","catalog","retail-filter-report.json");
const reportPath=path.join(root,"db","catalog","product-consolidation-report.json");

function readJsonIfPresent(filePath,fallback={}){
  return fs.existsSync(filePath)?JSON.parse(fs.readFileSync(filePath,"utf8")):fallback;
}

function mergeReportGroups(...collections){
  const groups=new Map();
  for(const group of collections.flat()){
    if(!group||!group.canonical_id) continue;
    const key=`${group.family_key||""}:${group.canonical_id}`;
    const existing=groups.get(key)||{...group,merged_ids:[]};
    existing.merged_ids=[...new Set([...(existing.merged_ids||[]),...(group.merged_ids||[])])];
    groups.set(key,existing);
  }
  return [...groups.values()];
}

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

function filterRetail(records,{qualityFirst=false}={}){
  const removed=[];
  const retained=[];
  for(const record of records){
    const reason=retailRemovalReason(record)||(qualityFirst?catalogQualityRemovalReason(record):"");
    if(reason) removed.push({id:record.id,name:record.name,reason});
    else retained.push(record);
  }
  return {retained,removed};
}

function withoutPackagingAliases(records){
  return records.map((record)=>({
    ...record,
    aliases:(record.aliases||[]).filter((alias)=>!retailPackagingBundleReason({name:alias}))
  }));
}

function flattenRedirects(...redirectMaps){
  const redirects=Object.assign({},...redirectMaps);
  for(const source of Object.keys(redirects)){
    const seen=new Set([source]);
    let target=redirects[source];
    while(target&&redirects[target]&&!seen.has(target)){
      seen.add(target);
      target=redirects[target];
    }
    if(target) redirects[source]=target;
  }
  return redirects;
}

function dedupeUntilStable(records){
  let current=records||[];
  let redirects={};
  let groups=[];
  let renamed=0;
  for(let passNumber=0;passNumber<6;passNumber++){
    const pass=dedupeCatalogRecords(current);
    current=pass.records;
    redirects=flattenRedirects(redirects,pass.redirects);
    groups=mergeReportGroups(groups,pass.groups);
    renamed+=pass.renamed||0;
    if(!pass.removed&&!pass.renamed) break;
  }
  return {
    records:current,
    redirects,
    groups,
    removed:Object.keys(redirects).length,
    renamed
  };
}

const base=JSON.parse(fs.readFileSync(basePath,"utf8"));
const baseProductPass=consolidateCatalogProducts(base.bottles||[],base.id_redirects||{});
const baseSafePass=dedupeUntilStable(baseProductPass.records);
const baseConsolidated={
  records:baseSafePass.records,
  redirects:flattenRedirects(baseProductPass.redirects,baseSafePass.redirects),
  groups:baseProductPass.groups.concat(baseSafePass.groups),
  removed:baseProductPass.removed+baseSafePass.removed
};
const baseRetail=filterRetail(withoutPackagingAliases(baseConsolidated.records));
const retainedBaseIds=new Set(baseRetail.retained.map((record)=>record.id));
const baseRedirects=Object.fromEntries(Object.entries(baseConsolidated.redirects).filter(([,target])=>retainedBaseIds.has(target)));
const updated=new Date().toISOString();
const baseMeta={
  ...Object.fromEntries(Object.entries(base).filter(([key])=>key!=="bottles"&&key!=="id_redirects")),
  version:Math.max(8,Number(base.version)||0),
  updated,
  count:baseRetail.retained.length,
  retail_filter_version:RETAIL_FILTER_VERSION,
  retail_max_usd:MAX_RETAIL_USD,
  retail_max_pln:MAX_RETAIL_PLN,
  product_consolidation_version:"retail-product-v2",
  product_duplicates_removed:Object.keys(baseRedirects).length,
  product_redirect_count:Object.keys(baseRedirects).length,
  retail_records_removed:baseRetail.removed.length,
  id_redirects:baseRedirects
};
fs.writeFileSync(basePath,JSON.stringify({...baseMeta,bottles:baseRetail.retained},null,2)+"\n");

const catalog=JSON.parse(fs.readFileSync(catalogPath,"utf8"));
const quality=JSON.parse(fs.readFileSync(qualityPath,"utf8"));
const retailReport=JSON.parse(fs.readFileSync(retailReportPath,"utf8"));
const resetHistory=process.env.RESET_CONSOLIDATION_HISTORY==="1";
const previousRedirectReport=resetHistory?{groups:[]}:readJsonIfPresent(redirectsPath,{groups:[]});
const previousProductReport=resetHistory
  ?{base:{groups:[],removals:[]},catalog:{groups:[],removals:[]}}
  :readJsonIfPresent(reportPath,{base:{groups:[],removals:[]},catalog:{groups:[],removals:[]}});
const productPass=consolidateCatalogProducts(catalog.bottles||[],{...(catalog.id_redirects||{}),...baseRedirects});
const safePass=dedupeUntilStable(productPass.records);
const combinedRedirects=flattenRedirects(productPass.redirects,safePass.redirects);
const catalogConsolidated={
  records:safePass.records,
  redirects:combinedRedirects,
  groups:productPass.groups.concat(safePass.groups),
  removed:productPass.removed+safePass.removed
};
const catalogRetail=filterRetail(withoutPackagingAliases(catalogConsolidated.records),{qualityFirst:true});
const retainedCatalogIds=new Set(catalogRetail.retained.map((record)=>record.id));
const catalogRedirects=Object.fromEntries(Object.entries(catalogConsolidated.redirects).filter(([,target])=>retainedCatalogIds.has(target)));
const meta={
  ...Object.fromEntries(Object.entries(catalog).filter(([key])=>key!=="bottles"&&key!=="id_redirects")),
  updated,
  count:catalogRetail.retained.length,
  retail_filter_version:RETAIL_FILTER_VERSION,
  retail_max_usd:MAX_RETAIL_USD,
  retail_max_pln:MAX_RETAIL_PLN,
  product_consolidation_version:"retail-product-v2",
  product_duplicates_removed:Object.keys(catalogRedirects).length,
  product_redirect_count:Object.keys(catalogRedirects).length,
  id_redirects:catalogRedirects
};
const scanBottles=catalogRetail.retained.map(scanRecord);
const baseGroups=mergeReportGroups(previousProductReport.base?.groups||[],baseConsolidated.groups);
const catalogGroups=mergeReportGroups(previousRedirectReport.groups||[],previousProductReport.catalog?.groups||[],catalogConsolidated.groups);
const updatedQuality={
  ...quality,
  ...Object.fromEntries(Object.entries(meta).filter(([key])=>key!=="id_redirects")),
  count:catalogRetail.retained.length,
  selected_verified_price:catalogRetail.retained.filter((record)=>record.catalog_status==="verified").length,
  selected_recognition_only:catalogRetail.retained.filter((record)=>record.catalog_status!=="verified").length,
  missing:{
    proof:catalogRetail.retained.filter((record)=>!record.proof).length,
    abv:catalogRetail.retained.filter((record)=>!record.abv).length,
    distillery:catalogRetail.retained.filter((record)=>!record.distillery).length,
    price:catalogRetail.retained.filter((record)=>!record.price).length
  }
};
const qualityRemovedTotal=Math.max(
  Number(retailReport.quality_removed)||0,
  Number(previousProductReport.catalog?.retail_removed)||0,
  catalogRetail.removed.filter((record)=>record.reason==="recognition-only-incomplete").length
);
const legacyFilter={
  removed:Number(retailReport.legacy_filter?.removed??retailReport.removed)||0,
  reasons:retailReport.legacy_filter?.reasons||retailReport.reasons||{}
};

fs.writeFileSync(catalogPath,JSON.stringify({...meta,bottles:catalogRetail.retained},null,2)+"\n");
fs.writeFileSync(scanPath,JSON.stringify({...meta,bottles:scanBottles,token_index:buildCatalogTokenIndex(scanBottles)})+"\n");
fs.writeFileSync(qualityPath,JSON.stringify(updatedQuality,null,2)+"\n");
fs.writeFileSync(retailReportPath,JSON.stringify({
  version:3,
  updated,
  policy:RETAIL_FILTER_VERSION,
  max_usd:MAX_RETAIL_USD,
  max_pln:MAX_RETAIL_PLN,
  before:catalogRetail.retained.length+qualityRemovedTotal,
  after:catalogRetail.retained.length,
  removed:qualityRemovedTotal,
  quality_removed:qualityRemovedTotal,
  reasons:{"recognition-only-incomplete":qualityRemovedTotal},
  legacy_filter:legacyFilter,
  product_consolidation_version:"retail-product-v2",
  product_duplicates_removed:Object.keys(catalogRedirects).length,
  product_redirect_count:Object.keys(catalogRedirects).length
},null,2)+"\n");
fs.writeFileSync(redirectsPath,JSON.stringify({
  version:2,updated,count:Object.keys(catalogRedirects).length,redirects:catalogRedirects,groups:catalogGroups
},null,2)+"\n");
fs.writeFileSync(reportPath,JSON.stringify({
  version:2,updated,policy:"retail-product-v2",
  base:{
    before:(base.bottles||[]).length,
    after:baseRetail.retained.length,
    merged:Object.keys(baseRedirects).length,
    merged_this_run:baseConsolidated.removed,
    redirects_total:Object.keys(baseRedirects).length,
    retail_removed:baseRetail.removed.length,
    groups:baseGroups,
    removals:[...previousProductReport.base?.removals||[],...baseRetail.removed]
  },
  catalog:{
    before:(catalog.bottles||[]).length,
    after:catalogRetail.retained.length,
    merged:Object.keys(catalogRedirects).length,
    merged_this_run:catalogConsolidated.removed,
    redirects_total:Object.keys(catalogRedirects).length,
    retail_removed:catalogRetail.removed.length,
    groups:catalogGroups,
    removals:[...previousProductReport.catalog?.removals||[],...catalogRetail.removed]
  }
},null,2)+"\n");

console.log(JSON.stringify({
  ok:true,
  base:{before:(base.bottles||[]).length,after:baseRetail.retained.length,merged:baseConsolidated.removed,retail_removed:baseRetail.removed.length},
  catalog:{before:(catalog.bottles||[]).length,after:catalogRetail.retained.length,merged:catalogConsolidated.removed,retail_removed:catalogRetail.removed.length},
  redirects:Object.keys(catalogRedirects).length,
  report:reportPath
},null,2));
