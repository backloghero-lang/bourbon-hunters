import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require=createRequire(import.meta.url);
const sharp=require("sharp");
const root=path.resolve(import.meta.dirname,"..");
const reviewMissingThumbs=process.argv.includes("--missing-thumbs");
const reviewPrepared=process.argv.includes("--prepared");
const report=JSON.parse(fs.readFileSync(path.join(root,"db","catalog","demo-image-fetch-report.json"),"utf8"));
const catalog=JSON.parse(fs.readFileSync(path.join(root,"db","catalog","demo-200.json"),"utf8"));
const outputDir=path.join(root,"tmp",reviewPrepared?"demo-prepared-detail-review":reviewMissingThumbs?"demo-missing-thumb-review":"demo-image-candidate-review");
const escapeXml=(value)=>String(value||"").replace(/[&<>]/g,(character)=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[character]));

const preparedIds=reviewPrepared?new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(root,"db","catalog","demo-detail-preparation.json"),"utf8")).items||{})):new Set();
const candidates=reviewPrepared
  ? (catalog.bottles||[]).filter((item)=>preparedIds.has(item.id)).map((item)=>({id:item.id,name:item.name,image:item.image}))
  : reviewMissingThumbs
  ? (catalog.bottles||[]).filter((item)=>item.demo_image_status!=="ready"&&item.thumb&&fs.existsSync(path.join(root,...item.thumb.split("/")))).map((item)=>({id:item.id,name:item.name,image:item.thumb}))
  : (report.downloaded||[]);
for(const item of candidates){
  if(item.dimensions) continue;
  const metadata=await sharp(path.join(root,...item.image.split("/")),{failOn:"none"}).metadata();
  item.dimensions={width:metadata.width||0,height:metadata.height||0};
}
fs.rmSync(outputDir,{recursive:true,force:true});
fs.mkdirSync(outputDir,{recursive:true});
for(let start=0;start<candidates.length;start+=12){
  const page=candidates.slice(start,start+12);
  const composites=[];
  for(const [index,item] of page.entries()){
    const source=path.join(root,...item.image.split("/"));
    const x=(index%4)*320,y=Math.floor(index/4)*410;
    const image=await sharp(source,{failOn:"none"}).rotate().resize(280,330,{fit:"contain",background:{r:8,g:8,b:7,alpha:1}}).png().toBuffer();
    const dimensions=item.dimensions?`${item.dimensions.width} x ${item.dimensions.height}`:"unknown size";
    const label=Buffer.from(`<svg width="300" height="64"><rect width="300" height="64" fill="#11110f"/><text x="5" y="18" fill="#efc56f" font-family="Arial" font-size="12">${escapeXml(item.name)}</text><text x="5" y="39" fill="#9ed6b2" font-family="Arial" font-size="11">${escapeXml(dimensions)}</text><text x="5" y="56" fill="#aaa" font-family="Arial" font-size="9">${escapeXml(item.id)}</text></svg>`);
    composites.push({input:image,left:x+20,top:y+8},{input:label,left:x+10,top:y+342});
  }
  const sheet=path.join(outputDir,`sheet-${String(start/12+1).padStart(2,"0")}.webp`);
  await sharp({create:{width:1280,height:1230,channels:4,background:{r:4,g:4,b:3,alpha:1}}}).composite(composites).webp({quality:92}).toFile(sheet);
}
console.log(JSON.stringify({ok:true,candidates:candidates.length,output:outputDir},null,2));
