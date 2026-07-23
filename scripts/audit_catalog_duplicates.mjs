import fs from "node:fs";
import path from "node:path";
import { catalogIdentityKey, catalogRecordsCompatible, dedupeCatalogRecords, identityAscii } from "./catalog_identity.mjs";

const root=path.resolve(import.meta.dirname,"..");
const catalog=JSON.parse(fs.readFileSync(path.join(root,"db","catalog","bottles.json"),"utf8"));

function groupBy(records,keyFor){
  const groups=new Map();
  for(const record of records){
    const key=keyFor(record);
    if(!key) continue;
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(record);
  }
  return [...groups.entries()].filter(([,records])=>records.length>1);
}

const exact=groupBy(catalog.bottles,(record)=>identityAscii(record.name));
const identity=groupBy(catalog.bottles,(record)=>catalogIdentityKey(record.name));
const identityIds=new Set(identity.flatMap(([,records])=>records.slice(1).map((record)=>record.id)));
const compatibleIdentity=identity.filter(([,records])=>records.some((record,index)=>records.slice(index+1).some((other)=>catalogRecordsCompatible(record,other))));
const safeDuplicateRecords=dedupeCatalogRecords(catalog.bottles).removed;

console.log(JSON.stringify({
  count:catalog.bottles.length,
  exact_groups:exact.length,
  exact_duplicate_records:exact.reduce((sum,[,records])=>sum+records.length-1,0),
  identity_groups:identity.length,
  identity_duplicate_records:identityIds.size,
  safe_duplicate_records:safeDuplicateRecords,
  projected_safe_count:catalog.bottles.length-safeDuplicateRecords,
  projected_aggressive_count:catalog.bottles.length-identityIds.size,
  samples:identity.slice(0,30).map(([key,records])=>({
    key,
    records:records.map((record)=>({id:record.id,name:record.name,type:record.type,category:record.category,source:record.source,image:!!record.image}))
  }))
},null,2));
