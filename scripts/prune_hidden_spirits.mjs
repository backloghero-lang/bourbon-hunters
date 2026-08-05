import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { buildCatalogTokenIndex } from "./catalog_identity.mjs";

const require=createRequire(import.meta.url);
const taxonomy=require("../spirit-taxonomy.js");
const root=path.resolve(import.meta.dirname,"..");
const targets=[
  {file:"db/bourbons.json",scan:false},
  {file:"db/catalog/bottles.json",scan:false},
  {file:"db/catalog/scan-index.json",scan:true},
  {file:"db/catalog/popular-200-catalog.json",scan:false}
];

const report=[];
for(const target of targets){
  const file=path.join(root,target.file);
  if(!fs.existsSync(file)) continue;
  const data=JSON.parse(fs.readFileSync(file,"utf8"));
  const before=Array.isArray(data.bottles)?data.bottles:[];
  const removed=before.filter((bottle)=>!taxonomy.isVisibleBottle(bottle));
  const bottles=before.filter(taxonomy.isVisibleBottle);
  const ids=new Set(bottles.map((bottle)=>bottle.id));
  const redirects=Object.fromEntries(Object.entries(data.id_redirects||{}).filter(([from,to])=>ids.has(to)&&!ids.has(from)));
  const output={...data,count:bottles.length,taxonomy_version:taxonomy.version,id_redirects:redirects,bottles};
  if(target.scan) output.token_index=buildCatalogTokenIndex(bottles);
  fs.writeFileSync(file,`${JSON.stringify(output,null,target.scan?0:2)}\n`);
  report.push({file:target.file,before:before.length,after:bottles.length,removed:removed.length});
}

console.log(JSON.stringify({ok:true,taxonomy:taxonomy.version,targets:report},null,2));
