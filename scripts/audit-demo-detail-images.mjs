import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require=createRequire(import.meta.url);
const sharp=require("sharp");
const root=path.resolve(import.meta.dirname,"..");
const catalogPath=path.join(root,"db","catalog","demo-200.json");
const legacyReportPath=path.join(root,"db","catalog","image-quality-report.json");
const reportPath=path.join(root,"db","catalog","demo-detail-image-audit.json");
const sheetDir=path.join(root,"tmp","demo-detail-image-audit");
const makeSheets=process.argv.includes("--contact-sheets");

const catalog=JSON.parse(fs.readFileSync(catalogPath,"utf8"));
const legacy=fs.existsSync(legacyReportPath)?JSON.parse(fs.readFileSync(legacyReportPath,"utf8")):{files:[]};
const sourceByClean=new Map((legacy.files||[]).filter((item)=>item.output).map((item)=>[item.output,item]));

function localPath(relative){ return path.join(root,...String(relative||"").split("/")); }
function round(value,digits=3){ return Number(Number(value||0).toFixed(digits)); }

async function inspectBottle(bottle){
  const image=String(bottle.image||"");
  if(!image||!fs.existsSync(localPath(image))){
    return {id:bottle.id,name:bottle.name,image,status:"missing",flags:["missing"]};
  }
  const input=sharp(localPath(image),{failOn:"none"}).rotate().ensureAlpha();
  const metadata=await input.metadata();
  const sample=await input.clone().resize({width:500,height:650,fit:"inside",withoutEnlargement:true}).raw().toBuffer({resolveWithObject:true});
  const {data,info}=sample;
  let minX=info.width,minY=info.height,maxX=-1,maxY=-1;
  let foreground=0,bright=0,semi=0,brightSemi=0,transparent=0;
  const border=[];
  for(let y=0;y<info.height;y++){
    for(let x=0;x<info.width;x++){
      const offset=(y*info.width+x)*info.channels;
      const alpha=data[offset+3];
      if(x<3||y<3||x>=info.width-3||y>=info.height-3) border.push((data[offset]+data[offset+1]+data[offset+2])/3);
      if(alpha<=20){ transparent++; continue; }
      foreground++;
      minX=Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y);
      const minimum=Math.min(data[offset],data[offset+1],data[offset+2]);
      if(minimum>=246) bright++;
      if(alpha<235){ semi++; if(minimum>=218) brightSemi++; }
    }
  }
  const bbox=maxX>=0?{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1}:null;
  const sharpnessImage=await input.clone().resize({width:420,height:560,fit:"inside",withoutEnlargement:true}).greyscale().convolve({width:3,height:3,kernel:[0,1,0,1,-4,1,0,1,0]}).stats();
  const sharpness=sharpnessImage.channels[0]?.stdev||0;
  const legacySource=sourceByClean.get(image);
  const sourceWidth=Number(legacySource?.width||metadata.width||0);
  const sourceHeight=Number(legacySource?.height||metadata.height||0);
  const bottleHeightRatio=bbox?bbox.height/info.height:0;
  const effectiveBottlePixels=Math.round(sourceHeight*bottleHeightRatio);
  const brightRatio=foreground?bright/foreground:0;
  const brightFringeRatio=semi?brightSemi/semi:0;
  const transparentRatio=transparent/(info.width*info.height);
  const borderAverage=border.reduce((sum,value)=>sum+value,0)/Math.max(1,border.length);
  const borderDeviation=Math.sqrt(border.reduce((sum,value)=>sum+(value-borderAverage)**2,0)/Math.max(1,border.length));
  const flags=[];
  if(effectiveBottlePixels<700) flags.push("low-effective-resolution");
  if(sharpness<8) flags.push("soft-or-upscaled");
  if(brightRatio>0.24) flags.push("overexposed");
  if(semi>30&&brightFringeRatio>0.58) flags.push("bright-alpha-fringe");
  if(transparentRatio<0.18) flags.push(borderDeviation>18?"complex-background":"opaque-background");
  if(!bbox||bottleHeightRatio<0.68) flags.push("bottle-too-small-in-frame");
  return {
    id:bottle.id,name:bottle.name,image,status:flags.length?"review":"pass",flags,
    encoded:{width:metadata.width||0,height:metadata.height||0,format:metadata.format||"",alpha:!!metadata.hasAlpha},
    source:{width:sourceWidth,height:sourceHeight,path:legacySource?.source||image},
    bottle_bbox:bbox,
    bottle_height_ratio:round(bottleHeightRatio),effective_bottle_pixels:effectiveBottlePixels,
    sharpness:round(sharpness,2),bright_ratio:round(brightRatio),bright_alpha_fringe_ratio:round(brightFringeRatio),
    transparent_ratio:round(transparentRatio),border_deviation:round(borderDeviation,2)
  };
}

const results=[];
for(const bottle of catalog.bottles||[]){
  try{ results.push(await inspectBottle(bottle)); }
  catch(error){ results.push({id:bottle.id,name:bottle.name,image:bottle.image||"",status:"review",flags:["decode-error"],error:String(error?.message||error)}); }
}

if(makeSheets){
  fs.rmSync(sheetDir,{recursive:true,force:true});
  fs.mkdirSync(sheetDir,{recursive:true});
  const visible=results.filter((item)=>item.image&&fs.existsSync(localPath(item.image)));
  for(let start=0;start<visible.length;start+=20){
    const page=visible.slice(start,start+20);
    const composites=[];
    for(const [index,item] of page.entries()){
      const x=(index%5)*260,y=Math.floor(index/5)*360;
      const bottle=await sharp(localPath(item.image)).resize(220,285,{fit:"contain",background:{r:10,g:10,b:9,alpha:1}}).png().toBuffer();
      const label=Buffer.from(`<svg width="240" height="52"><rect width="240" height="52" fill="#11110f"/><text x="5" y="17" fill="#efc56f" font-family="Arial" font-size="11">${String(item.name).replace(/[&<>]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}</text><text x="5" y="36" fill="${item.status==="pass"?"#65d889":"#ff7a6b"}" font-family="Arial" font-size="10">${item.flags.join(", ")||"PASS"}</text></svg>`);
      composites.push({input:bottle,left:x+20,top:y+10},{input:label,left:x+10,top:y+300});
    }
    await sharp({create:{width:1300,height:1440,channels:4,background:{r:5,g:5,b:4,alpha:1}}}).composite(composites).webp({quality:90}).toFile(path.join(sheetDir,`sheet-${String(start/20+1).padStart(2,"0")}.webp`));
  }
}

const report={
  version:"demo-detail-image-audit-v1",generated_at:new Date().toISOString(),catalog_size:results.length,
  present:results.filter((item)=>item.image).length,missing:results.filter((item)=>item.status==="missing").length,
  passed:results.filter((item)=>item.status==="pass").length,review:results.filter((item)=>item.status==="review").length,
  flag_counts:Object.fromEntries([...new Set(results.flatMap((item)=>item.flags||[]))].sort().map((flag)=>[flag,results.filter((item)=>(item.flags||[]).includes(flag)).length])),
  items:results
};
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({ok:true,...Object.fromEntries(Object.entries(report).filter(([key])=>key!=="items")),report:reportPath,sheets:makeSheets?sheetDir:""},null,2));
