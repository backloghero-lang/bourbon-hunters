export function identityAscii(value){
  return String(value||"").toLowerCase()
    .replace(/[\u2018\u2019]/g,"'")
    .replace(/[’‘`]/g,"'")
    .replace(/([a-z0-9])'s\b/g,"$1s")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}

export function catalogIdentityKey(value){
  return identityAscii(value)
    .replace(/\b(50|100|200|375|500|700|750|1000|1750)\s*(ml|l)?\b/g," ")
    .replace(/\b(whisky|whiskey|bourbon|straight|kentucky|scotch|the)\b/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function number(value){
  const match=String(value??"").replace(",",".").match(/\d+(?:\.\d+)?/);
  return match?Number(match[0]):0;
}

export function catalogIdentityEvidence(record){
  const name=identityAscii(record&&record.name);
  const declaration=identityAscii(`${record&&record.name||""} ${record&&record.type||""} ${record&&record.category||""}`);
  const recipe=(declaration.match(/\b(?:ob|oe)[skqofv]\b/)||[])[0]||"";
  const age=Number((name.match(/\b(\d{1,2})\s*(?:year|years|yr|yrs|yo)\b/)||[])[1]||0);
  let spirit="";
  if(/\brye\b/.test(declaration)) spirit="rye";
  else if(/\bbourbon\b/.test(declaration)) spirit="bourbon";
  else if(/\bscotch\b/.test(declaration)) spirit="scotch";
  else if(/\birish\b/.test(declaration)) spirit="irish";
  else if(/\bmalt\b/.test(declaration)) spirit="malt";
  else if(/\bwheat\b|\bwheated\b/.test(declaration)) spirit="wheat";
  return {
    spirit,recipe,age,proof:number(record&&record.proof),
    flags:{
      bonded:/\bbonded\b|\bbottled in bond\b|\bbib\b/.test(declaration),
      single_barrel:/\bsingle barrel\b|\bsingle cask\b/.test(declaration),
      barrel_proof:/\bbarrel proof\b|\bcask strength\b|\bfull proof\b/.test(declaration),
      finished:/\bfinish(?:ed)?\b|\bsherry cask\b|\bport cask\b/.test(declaration),
      double_oaked:/\bdouble oak(?:ed)?\b|\bdouble barrel(?:ed)?\b/.test(declaration)
    }
  };
}

export function catalogRecordsCompatible(left,right){
  const a=catalogIdentityEvidence(left),b=catalogIdentityEvidence(right);
  if(a.spirit!==b.spirit) return false;
  if(!a.spirit){
    const leftClass=identityAscii(`${left&&left.type||""} ${left&&left.category||""}`);
    const rightClass=identityAscii(`${right&&right.type||""} ${right&&right.category||""}`);
    if(leftClass!==rightClass) return false;
  }
  if(a.recipe&&b.recipe&&a.recipe!==b.recipe) return false;
  if(a.age&&b.age&&a.age!==b.age) return false;
  if(a.proof&&b.proof&&Math.abs(a.proof-b.proof)>2) return false;
  for(const flag of Object.keys(a.flags)) if(a.flags[flag]!==b.flags[flag]) return false;
  return true;
}

function recordQuality(record,index){
  let score=0;
  if(record&&record.image) score+=1000;
  const source=identityAscii(record&&record.source);
  if(source&&!/ttb|olcc/.test(source)) score+=200;
  if(/ttb/.test(source)) score+=30;
  if(catalogIdentityEvidence(record).spirit) score+=20;
  if(record&&record.catalog_status==="verified") score+=80;
  if(record&&record.distillery) score+=20;
  if(number(record&&record.proof)) score+=10;
  if(number(record&&record.abv)) score+=10;
  if(record&&record.profile) score+=10;
  if(record&&record.source_url) score+=3;
  return score-index/1000000;
}

function mergeCluster(items){
  const ordered=[...items].sort((a,b)=>recordQuality(b.record,b.index)-recordQuality(a.record,a.index));
  const canonical={...ordered[0].record};
  const fill=[
    "distillery","producer_permit","region","proof","abv","mashbill","image","source_url","source_id",
    "price","price_currency","price_range","price_status","price_pln","quality","value","notes","desc","profile"
  ];
  for(const item of ordered.slice(1)){
    for(const field of fill){
      if((canonical[field]===null||canonical[field]===undefined||canonical[field]==="")&&item.record[field]!=null&&item.record[field]!==""){
        canonical[field]=item.record[field];
      }
    }
  }
  const verified=ordered.find((item)=>item.record.price_status==="verified");
  if(verified){
    for(const field of ["price","price_currency","price_range","price_status"]) canonical[field]=verified.record[field];
    canonical.catalog_status="verified";
  }
  canonical.aliases=[...new Set(ordered.flatMap((item)=>[item.record.name,...(item.record.aliases||[])]).filter(Boolean))];
  canonical.source_refs=[...new Set(ordered.flatMap((item)=>[item.record.source,...(item.record.source_refs||[])]).filter(Boolean))];
  return {record:canonical,canonical:ordered[0],merged:ordered.slice(1)};
}

export function dedupeCatalogRecords(records){
  const keyed=new Map();
  records.forEach((record,index)=>{
    const key=catalogIdentityKey(record&&record.name);
    if(!key) return;
    if(!keyed.has(key)) keyed.set(key,[]);
    keyed.get(key).push({record,index});
  });
  const consumed=new Set();
  const output=[];
  const redirects={};
  const mergedGroups=[];
  for(const items of keyed.values()){
    const clusters=[];
    for(const item of items){
      const cluster=clusters.find((candidate)=>candidate.every((other)=>catalogRecordsCompatible(item.record,other.record)));
      if(cluster) cluster.push(item); else clusters.push([item]);
    }
    for(const cluster of clusters){
      const result=mergeCluster(cluster);
      output.push({record:result.record,index:Math.min(...cluster.map((item)=>item.index))});
      cluster.forEach((item)=>consumed.add(item.index));
      for(const item of result.merged) redirects[item.record.id]=result.record.id;
      if(result.merged.length){
        mergedGroups.push({
          canonical_id:result.record.id,
          canonical_name:result.record.name,
          merged_ids:result.merged.map((item)=>item.record.id)
        });
      }
    }
  }
  records.forEach((record,index)=>{ if(!consumed.has(index)) output.push({record,index}); });
  output.sort((a,b)=>a.index-b.index);
  return {records:output.map((item)=>item.record),redirects,groups:mergedGroups,removed:Object.keys(redirects).length};
}

export function buildCatalogTokenIndex(bottles){
  const stop=new Set(["bourbon","whisky","whiskey","straight","bottled","bond","single","barrel","cask","proof","rye","scotch","malt","blend","blended","reserve","batch","finish","finished","kentucky","distillery","company","with","the","and","for"]);
  const index={};
  bottles.forEach((bottle,bottleIndex)=>{
    const words=new Set([bottle.name,...(bottle.aliases||[])].flatMap((value)=>identityAscii(value).split(" ")));
    for(const word of words){
      if((word.length<3&&!/^[0-9]+$/.test(word))||stop.has(word)) continue;
      (index[word]||=[]).push(bottleIndex);
    }
  });
  return index;
}
