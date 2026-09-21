import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require=createRequire(import.meta.url);
const sharp=require("sharp");
const root=path.resolve(import.meta.dirname,"..");
const demoPath=path.join(root,"db","catalog","demo-200.json");
const scanPath=path.join(root,"db","catalog","demo-scan-index.json");
const reportPath=path.join(root,"db","catalog","demo-detail-normalization-report.json");
const manifestPath=path.join(root,"db","catalog","demo-image-manifest.json");
const buildReportPath=path.join(root,"db","catalog","demo-build-report.json");
const manualReviewPath=path.join(root,"db","catalog","demo-detail-manual-review.json");
const preparationPath=path.join(root,"db","catalog","demo-detail-preparation.json");
const fetchReportPath=path.join(root,"db","catalog","demo-image-fetch-report.json");
const overridesPath=path.join(root,"db","catalog","demo-image-overrides.json");
const outputDir=path.join(root,"assets","bourbons","detail-200");
const apply=process.argv.includes("--apply");

const readJson=(file)=>JSON.parse(fs.readFileSync(file,"utf8"));
const localPath=(relative)=>path.join(root,...String(relative||"").split("/"));
const demo=readJson(demoPath);
const scan=readJson(scanPath);
const manualReview=fs.existsSync(manualReviewPath)?readJson(manualReviewPath):{};
const preparation=fs.existsSync(preparationPath)?(readJson(preparationPath).items||{}):{};
const manualRejected=manualReview.rejected||{};
const currentRejected=manualReview.current_rejected||{};
const manualAccepted=new Set(Object.keys(manualReview.accepted||{}));
const latestDownloads=fs.existsSync(fetchReportPath)?new Set((readJson(fetchReportPath).downloaded||[]).map((item)=>item.id)):new Set();
const qualityCandidates=fs.existsSync(overridesPath)
  ? new Set(Object.entries(readJson(overridesPath).items||{}).filter(([,item])=>item?.quality_candidate_version==="detail-packshot-candidate-v1").map(([id])=>id))
  : new Set();

function backgroundStats(data,width,height,channels){
  const values=[];
  const step=Math.max(1,Math.floor(Math.min(width,height)/90));
  for(let x=0;x<width;x+=step) for(const y of [0,height-1]) values.push([data[(y*width+x)*channels],data[(y*width+x)*channels+1],data[(y*width+x)*channels+2]]);
  for(let y=step;y<height-1;y+=step) for(const x of [0,width-1]) values.push([data[(y*width+x)*channels],data[(y*width+x)*channels+1],data[(y*width+x)*channels+2]]);
  const average=[0,1,2].map((channel)=>values.reduce((sum,value)=>sum+value[channel],0)/Math.max(1,values.length));
  const deviation=Math.sqrt(values.reduce((sum,value)=>sum+((value[0]-average[0])**2+(value[1]-average[1])**2+(value[2]-average[2])**2)/3,0)/Math.max(1,values.length));
  return {average,deviation};
}

function removePlainBackground(data,width,height,channels,background){
  const count=width*height,mask=new Uint8Array(count),queue=new Int32Array(count);
  let head=0,tail=0;
  const distance=(pixel)=>{
    const offset=pixel*channels;
    return Math.sqrt(((data[offset]-background[0])**2+(data[offset+1]-background[1])**2+(data[offset+2]-background[2])**2)/3);
  };
  const enqueue=(pixel)=>{
    if(mask[pixel]||distance(pixel)>48) return;
    mask[pixel]=1; queue[tail++]=pixel;
  };
  for(let x=0;x<width;x++){ enqueue(x); enqueue((height-1)*width+x); }
  for(let y=1;y<height-1;y++){ enqueue(y*width); enqueue(y*width+width-1); }
  while(head<tail){
    const pixel=queue[head++],x=pixel%width;
    if(x>0) enqueue(pixel-1);
    if(x+1<width) enqueue(pixel+1);
    if(pixel>=width) enqueue(pixel-width);
    if(pixel<count-width) enqueue(pixel+width);
  }
  for(let pixel=0;pixel<count;pixel++){
    const offset=pixel*channels;
    if(mask[pixel]){ data[offset+3]=0; continue; }
    const x=pixel%width,y=Math.floor(pixel/width);
    let near=false;
    for(let dy=-2;dy<=2&&!near;dy++) for(let dx=-2;dx<=2;dx++){
      const nx=x+dx,ny=y+dy;
      if(nx>=0&&nx<width&&ny>=0&&ny<height&&mask[ny*width+nx]){ near=true; break; }
    }
    if(near){
      const d=distance(pixel);
      if(d<88) data[offset+3]=Math.min(data[offset+3],Math.max(0,Math.round((d-36)/52*255)));
    }
  }
}

function components(data,width,height,channels){
  const count=width*height,seen=new Uint8Array(count),queue=new Int32Array(count),out=[];
  for(let start=0;start<count;start++){
    if(seen[start]||data[start*channels+3]<=35) continue;
    let head=0,tail=0,area=0,minX=width,minY=height,maxX=0,maxY=0;
    seen[start]=1; queue[tail++]=start;
    while(head<tail){
      const pixel=queue[head++],x=pixel%width,y=Math.floor(pixel/width);
      area++; minX=Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y);
      const visit=(next)=>{ if(next<0||next>=count||seen[next]||data[next*channels+3]<=35) return; seen[next]=1; queue[tail++]=next; };
      if(x>0) visit(pixel-1); if(x+1<width) visit(pixel+1); if(y>0) visit(pixel-width); if(y+1<height) visit(pixel+width);
    }
    out.push({area,minX,minY,maxX,maxY,width:maxX-minX+1,height:maxY-minY+1});
  }
  return out.sort((left,right)=>right.area-left.area);
}

async function normalize(record){
  const prepared=preparation[record.id]||{};
  const sourcePath=prepared.source||record.image;
  const explicitlyAccepted=prepared.accepted===true||manualAccepted.has(record.id);
  if(!sourcePath||!fs.existsSync(localPath(sourcePath))) return {id:record.id,name:record.name,status:"missing",reason:"source-missing",source:sourcePath||""};
  if(currentRejected[record.id]&&!explicitlyAccepted) return {id:record.id,name:record.name,source:sourcePath,status:"rejected",reason:"manual-current-rejection",detail:currentRejected[record.id]};
  if(manualRejected[record.id]&&!latestDownloads.has(record.id)&&!qualityCandidates.has(record.id)) return {id:record.id,name:record.name,source:sourcePath,status:"rejected",reason:"manual-visual-rejection",detail:manualRejected[record.id]};
  let decoded=sharp(localPath(sourcePath),{failOn:"none"}).rotate().ensureAlpha();
  const sourceMetadata=await decoded.metadata();
  let preparedWidth=sourceMetadata.width||1,preparedHeight=sourceMetadata.height||1;
  if(prepared.crop){
    const crop=prepared.crop;
    const left=Math.max(0,Math.round((sourceMetadata.width||1)*crop.left));
    const top=Math.max(0,Math.round((sourceMetadata.height||1)*crop.top));
    const cropWidth=Math.min((sourceMetadata.width||1)-left,Math.max(1,Math.round((sourceMetadata.width||1)*crop.width)));
    const cropHeight=Math.min((sourceMetadata.height||1)-top,Math.max(1,Math.round((sourceMetadata.height||1)*crop.height)));
    decoded=decoded
      .extract({left,top,width:cropWidth,height:cropHeight})
      .extend({top:16,bottom:16,left:16,right:16,background:{r:255,g:255,b:255,alpha:sourceMetadata.hasAlpha?0:1}});
    preparedWidth=cropWidth+32;
    preparedHeight=cropHeight+32;
  }
  if(prepared.remove_background===true) decoded=decoded.flatten({background:{r:255,g:255,b:255}}).ensureAlpha();
  let metadata={width:preparedWidth,height:preparedHeight};
  if(prepared.crop){
    const rendered=await decoded.png().toBuffer({resolveWithObject:true});
    decoded=sharp(rendered.data,{failOn:"none"}).ensureAlpha();
    metadata={width:rendered.info.width,height:rendered.info.height};
  }
  const scale=Math.min(1,1600/Math.max(metadata.width||1,metadata.height||1));
  const width=Math.max(1,Math.round((metadata.width||1)*scale)),height=Math.max(1,Math.round((metadata.height||1)*scale));
  const raw=await decoded.resize(width,height,{fit:"fill"}).raw().toBuffer({resolveWithObject:true});
  const pixels=Buffer.from(raw.data),channels=raw.info.channels;
  let transparent=0;
  for(let i=3;i<pixels.length;i+=channels) if(pixels[i]<=20) transparent++;
  const transparentRatio=transparent/(width*height);
  const border=backgroundStats(pixels,width,height,channels);
  if(transparentRatio<0.04){
    if(border.deviation>24&&!explicitlyAccepted) return {id:record.id,name:record.name,source:sourcePath,status:"rejected",reason:"complex-background",border_deviation:Number(border.deviation.toFixed(2))};
    removePlainBackground(pixels,width,height,channels,border.average);
  }
  const parts=components(pixels,width,height,channels);
  let primary=parts[0];
  if(!primary) return {id:record.id,name:record.name,source:sourcePath,status:"rejected",reason:"no-bottle-foreground"};
  if(prepared.include_aligned_components===true){
    const aligned=parts.filter((part)=>part.area>=primary.area*.004&&part.maxX>=primary.minX&&part.minX<=primary.maxX);
    primary={
      ...primary,
      minX:Math.min(...aligned.map((part)=>part.minX)),minY:Math.min(...aligned.map((part)=>part.minY)),
      maxX:Math.max(...aligned.map((part)=>part.maxX)),maxY:Math.max(...aligned.map((part)=>part.maxY))
    };
    primary.width=primary.maxX-primary.minX+1;
    primary.height=primary.maxY-primary.minY+1;
  }
  const secondary=parts.find((part)=>part!==parts[0]);
  if(primary.height<500) return {id:record.id,name:record.name,source:sourcePath,status:"rejected",reason:"low-effective-resolution",bottle_height:primary.height};
  if(secondary&&secondary.area/primary.area>0.18&&!explicitlyAccepted) return {id:record.id,name:record.name,source:sourcePath,status:"rejected",reason:"multiple-products",secondary_ratio:Number((secondary.area/primary.area).toFixed(3))};
  const marginX=Math.max(8,Math.round(primary.width*.035)),marginY=Math.max(8,Math.round(primary.height*.025));
  const left=Math.max(0,primary.minX-marginX),top=Math.max(0,primary.minY-marginY);
  const right=Math.min(width-1,primary.maxX+marginX),bottom=Math.min(height-1,primary.maxY+marginY);
  const output=`assets/bourbons/detail-200/${record.id}.webp`;
  if(apply){
    fs.mkdirSync(outputDir,{recursive:true});
    await sharp(pixels,{raw:{width,height,channels}})
      .extract({left,top,width:right-left+1,height:bottom-top+1})
      .resize(860,1180,{fit:"contain",position:"centre",background:{r:0,g:0,b:0,alpha:0},kernel:"lanczos3"})
      .extend({top:50,bottom:50,left:50,right:50,background:{r:0,g:0,b:0,alpha:0}})
      .sharpen({sigma:.45,m1:.45,m2:.85,x1:2,y2:10,y3:20})
      .webp({quality:93,alphaQuality:100,smartSubsample:true})
      .toFile(localPath(output));
  }
  return {id:record.id,name:record.name,source:sourcePath,output,status:"ready",source_dimensions:{width:metadata.width||0,height:metadata.height||0},output_dimensions:{width:960,height:1280},bottle_dimensions:{width:primary.width,height:primary.height},transparent_source:transparentRatio>=.04};
}

const results=[];
for(const [index,record] of (demo.bottles||[]).entries()){
  try{ results.push(await normalize(record)); }
  catch(error){ results.push({id:record.id,name:record.name,source:record.image||"",status:"rejected",reason:"processing-error",error:String(error?.message||error)}); }
  if((index+1)%20===0) process.stdout.write(`[${index+1}/${demo.bottles.length}] normalized\n`);
}

if(apply){
  const byId=new Map(results.map((item)=>[item.id,item]));
  for(const record of demo.bottles||[]){
    const result=byId.get(record.id);
    if(result?.status==="ready"){
      record.image=result.output;
      record.demo_image_status="ready";
      record.detail_image_audit="standardized-v1";
    }else{
      record.image="";
      record.demo_image_status="missing";
      record.detail_image_audit=result?.reason||"missing";
    }
  }
  for(const record of scan.bottles||[]){
    const detail=(demo.bottles||[]).find((item)=>item.id===record.id);
    record.image=detail?.image||"";
    record.thumb=detail?.thumb||"";
  }
  const active=new Set(results.filter((item)=>item.status==="ready").map((item)=>path.resolve(localPath(item.output))));
  if(fs.existsSync(outputDir)) for(const entry of fs.readdirSync(outputDir,{withFileTypes:true})){
    const absolute=path.resolve(outputDir,entry.name);
    if(entry.isFile()&&!active.has(absolute)) fs.unlinkSync(absolute);
  }
  demo.detail_image_standard="packshot-transparent-960x1280-v1";
  scan.detail_image_standard="packshot-transparent-960x1280-v1";
  fs.writeFileSync(demoPath,JSON.stringify(demo,null,2)+"\n");
  fs.writeFileSync(scanPath,JSON.stringify(scan,null,2)+"\n");
  if(fs.existsSync(manifestPath)){
    const manifest=readJson(manifestPath);
    const byId=new Map((demo.bottles||[]).map((record)=>[record.id,record]));
    for(const item of manifest.items||manifest.bottles||[]){
      const record=byId.get(item.id);
      if(!record) continue;
      item.image=record.image||"";
      item.thumb=record.thumb||"";
      item.status=record.demo_image_status||"missing";
      item.detail_image_audit=record.detail_image_audit||"missing";
    }
    manifest.detail_image_standard=demo.detail_image_standard;
    manifest.ready=(demo.bottles||[]).filter((record)=>record.demo_image_status==="ready").length;
    manifest.missing=(demo.bottles||[]).length-manifest.ready;
    fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+"\n");
  }
  if(fs.existsSync(buildReportPath)){
    const buildReport=readJson(buildReportPath);
    buildReport.detail_images_ready=(demo.bottles||[]).filter((record)=>record.demo_image_status==="ready").length;
    buildReport.missing_images=(demo.bottles||[]).length-buildReport.detail_images_ready;
    buildReport.detail_image_standard=demo.detail_image_standard;
    fs.writeFileSync(buildReportPath,JSON.stringify(buildReport,null,2)+"\n");
  }
}

const report={
  version:"packshot-transparent-960x1280-v1",generated_at:new Date().toISOString(),applied:apply,total:results.length,
  ready:results.filter((item)=>item.status==="ready").length,missing:results.filter((item)=>item.status==="missing").length,
  rejected:results.filter((item)=>item.status==="rejected").length,
  rejection_reasons:Object.fromEntries([...new Set(results.filter((item)=>item.reason).map((item)=>item.reason))].sort().map((reason)=>[reason,results.filter((item)=>item.reason===reason).length])),
  items:results
};
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({...report,items:undefined,report:reportPath},null,2));
