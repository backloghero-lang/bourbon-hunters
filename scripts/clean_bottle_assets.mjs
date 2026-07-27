import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require=createRequire(import.meta.url);
const sharp=require("sharp");
const root=path.resolve(import.meta.dirname,"..");
const basePath=path.join(root,"db","bourbons.json");
const catalogPath=path.join(root,"db","catalog","bottles.json");
const reportPath=path.join(root,"db","catalog","image-quality-report.json");
const overridesPath=path.join(root,"db","catalog","image-asset-overrides.json");
const outputDir=path.join(root,"assets","bourbons","clean");
const apply=process.argv.includes("--apply");
const rebuild=process.argv.includes("--rebuild");
const ASSET_QUALITY_VERSION="single-bottle-transparent-v3-no-watermarks";
const overrides=JSON.parse(fs.readFileSync(overridesPath,"utf8"));
const forceAccept=new Set(overrides.force_accept||[]);
const forceReject=new Set(overrides.reject||[]);
const previousReport=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath,"utf8")):{files:[]};
const previousSourceByOutput=new Map((previousReport.files||[]).filter((item)=>item.source&&item.output).map((item)=>[item.output,item.source]));
let providersByImage=new Map();

function isLocalBottleImage(value){
  return /^assets\/bourbons\/(?!clean\/).+\.(?:png|jpe?g|webp)$/i.test(String(value||""));
}

function cleanOutputPath(source){
  const stem=path.basename(source,path.extname(source)).replace(/[^a-z0-9-]+/gi,"-").replace(/^-+|-+$/g,"").toLowerCase();
  return `assets/bourbons/clean/${stem}.webp`;
}

function isWhitePixel(data,index,channels){
  const alpha=channels===4?data[index+3]:255;
  if(alpha<20) return true;
  const r=data[index],g=data[index+1],b=data[index+2];
  return Math.min(r,g,b)>=226&&Math.max(r,g,b)-Math.min(r,g,b)<=38;
}

function borderConnectedBackground(data,width,height,channels){
  const count=width*height;
  const background=new Uint8Array(count);
  const queue=new Int32Array(count);
  let head=0,tail=0,borderWhite=0,borderCount=0;
  const enqueue=(pixel)=>{
    if(background[pixel]) return;
    const offset=pixel*channels;
    if(!isWhitePixel(data,offset,channels)) return;
    background[pixel]=1;
    queue[tail++]=pixel;
  };
  for(let x=0;x<width;x++){
    for(const y of [0,height-1]){
      borderCount++;
      if(isWhitePixel(data,(y*width+x)*channels,channels)) borderWhite++;
      enqueue(y*width+x);
    }
  }
  for(let y=1;y<height-1;y++){
    for(const x of [0,width-1]){
      borderCount++;
      if(isWhitePixel(data,(y*width+x)*channels,channels)) borderWhite++;
      enqueue(y*width+x);
    }
  }
  while(head<tail){
    const pixel=queue[head++];
    const x=pixel%width,y=Math.floor(pixel/width);
    if(x>0) enqueue(pixel-1);
    if(x+1<width) enqueue(pixel+1);
    if(y>0) enqueue(pixel-width);
    if(y+1<height) enqueue(pixel+width);
  }
  return {background,borderWhiteRatio:borderCount?borderWhite/borderCount:0};
}

function foregroundComponents(background,width,height){
  const count=width*height;
  const seen=new Uint8Array(count);
  const queue=new Int32Array(count);
  const components=[];
  for(let start=0;start<count;start++){
    if(background[start]||seen[start]) continue;
    let head=0,tail=0,area=0;
    let minX=width,minY=height,maxX=0,maxY=0;
    seen[start]=1;
    queue[tail++]=start;
    while(head<tail){
      const pixel=queue[head++];
      const x=pixel%width,y=Math.floor(pixel/width);
      area++;
      if(x<minX) minX=x;
      if(x>maxX) maxX=x;
      if(y<minY) minY=y;
      if(y>maxY) maxY=y;
      const visit=(next)=>{
        if(next<0||next>=count||seen[next]||background[next]) return;
        seen[next]=1;
        queue[tail++]=next;
      };
      if(x>0) visit(pixel-1);
      if(x+1<width) visit(pixel+1);
      if(y>0) visit(pixel-width);
      if(y+1<height) visit(pixel+width);
    }
    components.push({area,minX,minY,maxX,maxY,width:maxX-minX+1,height:maxY-minY+1});
  }
  return components.sort((a,b)=>b.area-a.area);
}

function foregroundComponentMap(background,width,height){
  const count=width*height;
  const labels=new Uint32Array(count);
  const queue=new Int32Array(count);
  const components=[];
  let id=0;
  for(let start=0;start<count;start++){
    if(background[start]||labels[start]) continue;
    id++;
    let head=0,tail=0,area=0;
    let minX=width,minY=height,maxX=0,maxY=0;
    labels[start]=id;
    queue[tail++]=start;
    while(head<tail){
      const pixel=queue[head++];
      const x=pixel%width,y=Math.floor(pixel/width);
      area++;
      if(x<minX) minX=x;
      if(x>maxX) maxX=x;
      if(y<minY) minY=y;
      if(y>maxY) maxY=y;
      const visit=(next)=>{
        if(next<0||next>=count||labels[next]||background[next]) return;
        labels[next]=id;
        queue[tail++]=next;
      };
      if(x>0) visit(pixel-1);
      if(x+1<width) visit(pixel+1);
      if(y>0) visit(pixel-width);
      if(y+1<height) visit(pixel+width);
    }
    components.push({id,area,minX,minY,maxX,maxY,width:maxX-minX+1,height:maxY-minY+1});
  }
  components.sort((a,b)=>b.area-a.area);
  return {labels,components};
}

async function inspectAsset(relativePath){
  const absolute=path.join(root,...relativePath.split("/"));
  const source=sharp(absolute,{failOn:"none"}).rotate();
  const metadata=await source.metadata();
  const sampleScale=Math.min(1,240/Math.max(metadata.width||1,metadata.height||1));
  const sampleWidth=Math.max(1,Math.round((metadata.width||1)*sampleScale));
  const sampleHeight=Math.max(1,Math.round((metadata.height||1)*sampleScale));
  const sample=await source.clone().resize(sampleWidth,sampleHeight,{fit:"fill"}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const sampleMask=borderConnectedBackground(sample.data,sample.info.width,sample.info.height,4);
  const components=foregroundComponents(sampleMask.background,sample.info.width,sample.info.height);
  const primary=components[0]||null;
  const secondary=components[1]||null;
  const primaryAreaRatio=primary?primary.area/(sample.info.width*sample.info.height):0;
  const primaryHeightRatio=primary?primary.height/sample.info.height:0;
  const secondaryRatio=primary&&secondary?secondary.area/primary.area:0;
  const primaryShape=primary?primary.height/Math.max(1,primary.width):0;
  let topForegroundWidthRatio=0;
  if(primary){
    const topEnd=Math.min(sample.info.height-1,Math.floor(primary.minY+primary.height*0.3));
    let widest=0;
    for(let y=primary.minY;y<=topEnd;y++){
      let minX=sample.info.width,maxX=-1;
      for(let x=0;x<sample.info.width;x++){
        if(!sampleMask.background[y*sample.info.width+x]){
          if(x<minX) minX=x;
          if(x>maxX) maxX=x;
        }
      }
      if(maxX>=minX) widest=Math.max(widest,maxX-minX+1);
    }
    topForegroundWidthRatio=widest/Math.max(1,primary.width);
  }
  const secondaryCenterX=secondary?(secondary.minX+secondary.maxX)/2:0;
  const secondaryGap=primary&&secondary?Math.max(0,primary.minY-secondary.maxY-1,secondary.minY-primary.maxY-1):0;
  const secondaryLooksAttached=!!(primary&&secondary&&
    secondaryCenterX>=primary.minX+primary.width*0.14&&
    secondaryCenterX<=primary.maxX-primary.width*0.14&&
    secondary.width<=primary.width*0.86&&
    secondaryGap<=primary.height*0.15);
  const providers=providersByImage.get(relativePath)||new Set();
  const retailerWatermark=providers.has("domwhisky");
  const whiteBackground=sampleMask.borderWhiteRatio>=0.55;
  let rejection="";
  if(forceReject.has(relativePath)) rejection="manual-accessory-or-packaging-rejection";
  else if(retailerWatermark) rejection="retailer-watermark";
  else if(forceAccept.has(relativePath)) rejection="";
  else if(!whiteBackground&&!metadata.hasAlpha) rejection="non-white-existing-background";
  else if(!primary||primaryAreaRatio<0.012||primaryHeightRatio<0.32) rejection="no-clear-bottle";
  else if(primaryShape<1.08) rejection="label-or-non-bottle-artwork";
  else if(secondaryRatio>0.16&&!secondaryLooksAttached) rejection="multiple-products-or-accessories";

  return {
    source:relativePath,
    output:cleanOutputPath(relativePath),
    width:metadata.width||0,
    height:metadata.height||0,
    has_alpha:!!metadata.hasAlpha,
    border_white_ratio:Number(sampleMask.borderWhiteRatio.toFixed(3)),
    primary_area_ratio:Number(primaryAreaRatio.toFixed(3)),
    primary_height_ratio:Number(primaryHeightRatio.toFixed(3)),
    primary_shape:Number(primaryShape.toFixed(3)),
    top_foreground_width_ratio:Number(topForegroundWidthRatio.toFixed(3)),
    providers:[...providers],
    secondary_ratio:Number(secondaryRatio.toFixed(3)),
    secondary_looks_attached:secondaryLooksAttached,
    accepted:!rejection,
    rejection,
    sample:{width:sample.info.width,height:sample.info.height,primary}
  };
}

async function renderCleanAsset(result){
  const absolute=path.join(root,...result.source.split("/"));
  const source=sharp(absolute,{failOn:"none"}).rotate().ensureAlpha();
  const raw=await source.raw().toBuffer({resolveWithObject:true});
  const width=raw.info.width,height=raw.info.height,channels=raw.info.channels;
  const mask=borderConnectedBackground(raw.data,width,height,channels);
  const mapped=foregroundComponentMap(mask.background,width,height);
  const primary=mapped.components[0];
  if(!primary) throw new Error("no_primary_component");
  const keptIds=new Set(mapped.components.filter((component)=>{
    if(component.id===primary.id) return true;
    const centerX=(component.minX+component.maxX)/2;
    const centerY=(component.minY+component.maxY)/2;
    return centerX>=primary.minX&&centerX<=primary.maxX&&centerY>=primary.minY&&centerY<=primary.maxY;
  }).map((component)=>component.id));
  const marginX=Math.max(4,Math.round(primary.width*0.055));
  const marginY=Math.max(4,Math.round(primary.height*0.045));
  const left=Math.max(0,primary.minX-marginX);
  const top=Math.max(0,primary.minY-marginY);
  const right=Math.min(width-1,primary.maxX+marginX);
  const bottom=Math.min(height-1,primary.maxY+marginY);
  const pixels=Buffer.from(raw.data);
  for(let pixel=0;pixel<width*height;pixel++){
    const offset=pixel*channels;
    if(mask.background[pixel]||!keptIds.has(mapped.labels[pixel])){
      pixels[offset+3]=0;
      continue;
    }
    const x=pixel%width,y=Math.floor(pixel/width);
    const touchesBackground=
      (x>0&&mask.background[pixel-1])||
      (x+1<width&&mask.background[pixel+1])||
      (y>0&&mask.background[pixel-width])||
      (y+1<height&&mask.background[pixel+width]);
    if(touchesBackground){
      const average=(pixels[offset]+pixels[offset+1]+pixels[offset+2])/3;
      if(average>180) pixels[offset+3]=Math.min(pixels[offset+3],Math.max(0,Math.min(255,Math.round((255-average)*7.3))));
    }
  }
  const outputAbsolute=path.join(root,...result.output.split("/"));
  fs.mkdirSync(path.dirname(outputAbsolute),{recursive:true});
  await sharp(pixels,{raw:{width,height,channels}})
    .extract({left,top,width:right-left+1,height:bottom-top+1})
    .resize(760,1000,{fit:"contain",position:"centre",background:{r:0,g:0,b:0,alpha:0},kernel:"lanczos3"})
    .sharpen({sigma:0.65,m1:0.75,m2:1.2,x1:2,y2:10,y3:20})
    .webp({quality:92,alphaQuality:100,smartSubsample:true})
    .toFile(outputAbsolute);
}

function replaceImages(document,replacements,rejected){
  const bottles=document.bottles||[];
  let replaced=0,cleared=0;
  for(const bottle of bottles){
    const current=String(bottle.image||"").replaceAll("\\","/");
    const source=String(bottle.image_source||previousSourceByOutput.get(current)||current).replaceAll("\\","/");
    if(replacements.has(source)){
      bottle.image_source=source;
      bottle.image=replacements.get(source);
      bottle.image_quality=ASSET_QUALITY_VERSION;
      replaced++;
    }else if(rejected.has(source)){
      bottle.image="";
      bottle.image_quality="mystery-fallback";
      cleared++;
    }
  }
  return {replaced,cleared};
}

const base=JSON.parse(fs.readFileSync(basePath,"utf8"));
const catalog=JSON.parse(fs.readFileSync(catalogPath,"utf8"));
for(const record of [...(base.bottles||[]),...(catalog.bottles||[])]){
  const current=String(record.image||"").replaceAll("\\","/");
  const source=String(record.image_source||previousSourceByOutput.get(current)||current).replaceAll("\\","/");
  if(!isLocalBottleImage(source)) continue;
  if(!providersByImage.has(source)) providersByImage.set(source,new Set());
  providersByImage.get(source).add(String(record.source||""));
}
const sources=[...new Set([
  ...(base.bottles||[]).map((record)=>record.image_source||previousSourceByOutput.get(record.image)||record.image),
  ...(catalog.bottles||[]).map((record)=>record.image_source||previousSourceByOutput.get(record.image)||record.image),
  ...(previousReport.files||[]).map((record)=>record.source)
].filter(isLocalBottleImage))].sort();
const results=[];
for(const source of sources){
  try{
    results.push(await inspectAsset(source));
  }catch(error){
    results.push({source,accepted:false,rejection:"decode-error",error:String(error&&error.message||error)});
  }
}

const accepted=results.filter((result)=>result.accepted);
const rejected=results.filter((result)=>!result.accepted);
const replacements=new Map(accepted.map((result)=>[result.source,result.output]));
const rejectedPaths=new Set(rejected.filter((result)=>result.rejection!=="non-white-existing-background").map((result)=>result.source));
let baseChanges={replaced:0,cleared:0};
let catalogChanges={replaced:0,cleared:0};
let orphanCleanAssetsRemoved=0;
if(apply){
  for(const result of accepted){
    const outputAbsolute=path.join(root,...result.output.split("/"));
    if(rebuild||!fs.existsSync(outputAbsolute)) await renderCleanAsset(result);
  }
  const activeOutputs=new Set(accepted.map((result)=>path.resolve(root,...result.output.split("/"))));
  if(fs.existsSync(outputDir)){
    for(const entry of fs.readdirSync(outputDir,{withFileTypes:true})){
      if(!entry.isFile()||!entry.name.toLowerCase().endsWith(".webp")) continue;
      const absolute=path.resolve(outputDir,entry.name);
      if(activeOutputs.has(absolute)) continue;
      fs.unlinkSync(absolute);
      orphanCleanAssetsRemoved++;
    }
  }
  baseChanges=replaceImages(base,replacements,rejectedPaths);
  catalogChanges=replaceImages(catalog,replacements,rejectedPaths);
  const updated=new Date().toISOString();
  base.image_quality_version=ASSET_QUALITY_VERSION;
  base.updated=updated;
  catalog.image_quality_version=ASSET_QUALITY_VERSION;
  catalog.updated=updated;
  fs.writeFileSync(basePath,JSON.stringify(base,null,2)+"\n");
  fs.writeFileSync(catalogPath,JSON.stringify(catalog,null,2)+"\n");
}

const report={
  version:1,
  asset_quality_version:ASSET_QUALITY_VERSION,
  generated_at:new Date().toISOString(),
  applied:apply,
  source_count:sources.length,
  accepted:accepted.length,
  rejected:rejected.length,
  low_resolution:results.filter((result)=>result.width<500||result.height<500).length,
  white_background:results.filter((result)=>result.border_white_ratio>=0.55).length,
  base_changes:baseChanges,
  catalog_changes:catalogChanges,
  orphan_clean_assets_removed:orphanCleanAssetsRemoved,
  rejection_reasons:Object.fromEntries([...new Set(rejected.map((result)=>result.rejection))].sort().map((reason)=>[
    reason,rejected.filter((result)=>result.rejection===reason).length
  ])),
  files:results
};
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({
  ok:true,
  applied:apply,
  source_count:sources.length,
  accepted:accepted.length,
  rejected:rejected.length,
  low_resolution:report.low_resolution,
  white_background:report.white_background,
  base_changes:baseChanges,
  catalog_changes:catalogChanges,
  orphan_clean_assets_removed:orphanCleanAssetsRemoved,
  rejection_reasons:report.rejection_reasons,
  report:reportPath
},null,2));
