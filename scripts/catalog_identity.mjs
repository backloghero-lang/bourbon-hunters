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
    .replace(/\b\d{2,3}(?:\.\d+)?\s*proof\b/g," ")
    .replace(/\b(50|100|200|375|500|700|750|1000|1750)\s*(ml|l)?\b/g," ")
    .replace(/\b(?:years?|yrs?)\s+old\b/g," year")
    .replace(/\byrs?\b/g,"year")
    .replace(/\b(?:w|with)\s+(?:\d+\s+)?glasses?\b/g," ")
    .replace(/\b(?:gift|value)\s+(?:pack|set|box)\b/g," ")
    .replace(/\b(?:barrel|bottle)\s+only\b/g," ")
    .replace(/\b(whisky|whiskey|bourbon|straight|kentucky|scotch|the)\b/g," ")
    .replace(/\s+/g," ")
    .trim();
}

export function catalogProductIdentityKey(value){
  return catalogIdentityKey(
    identityAscii(value)
      .replace(/\b(?:selected|select|picked|chosen)\s+by\b.*$/," ")
      .replace(/\b(?:selection|pick)\s+for\b.*$/," ")
      .replace(/\b(?:private|store)\s+(?:barrel|cask|pick|selection)\b.*$/," single barrel ")
      .replace(/\b(?:sdbb|bold pick)\b.*$/," single barrel ")
      .replace(/\b(?:warehouse|rickhouse)\s+[a-z0-9-]+(?:\s+floor\s+[a-z0-9-]+)?\b.*$/," ")
      .replace(/\b(?:barrel|cask)\s*(?:no|number|n)?\s*#?\s*\d+[a-z0-9.-]*\b.*$/," ")
      .replace(/\bbatch\s*(?:no|number)?\s*#?\s*[a-z]?\d+[a-z0-9.-]*\b/g," ")
      .replace(/\b(?:first|second|third|fourth|fifth)\s+release\b/g," ")
      .replace(/\b20(?:0\d|1\d|2[0-6])\b/g," ")
      .replace(/\b(?:bottling|vintage)\s+20(?:0\d|1\d|2[0-6])\b/g," ")
      .replace(/\b(?:w|with)\s+(?:\d+\s+)?(?:(?:rocks?|shot)\s+)?(?:glasses?|coasters?|tumblers?|mugs?|flasks?)\b/g," ")
      .replace(/\b(?:gift|value)\s+(?:pack|set|box)\b/g," ")
      .replace(/\b(?:vap|twin pack)\b/g," ")
      .replace(/\s+/g," ")
      .trim()
  );
}

export function catalogProductDisplayName(value){
  const original=String(value||"").trim();
  const cleaned=original
    .replace(/\b(?:selected|select|picked|chosen)\s+by\b.*$/i," ")
    .replace(/\b(?:selection|pick)\s+for\b.*$/i," ")
    .replace(/\b(?:private|store)\s+(?:barrel|cask|pick|selection)\b.*$/i,"Single Barrel")
    .replace(/\b(?:SDBB|bold pick)\b.*$/i,"Single Barrel")
    .replace(/\b(?:warehouse|rickhouse)\s+[a-z0-9-]+(?:\s+floor\s+[a-z0-9-]+)?\b.*$/i," ")
    .replace(/\b(?:barrel|cask)\s*(?:no\.?|number|n)?\s*#?\s*\d+[a-z0-9.-]*\b.*$/i," ")
    .replace(/\bbatch\s*(?:no\.?|number)?\s*#?\s*[a-z]?\d+[a-z0-9.-]*\b/ig," ")
    .replace(/\b(?:first|second|third|fourth|fifth)\s+release\b/ig," ")
    .replace(/\b20(?:0\d|1\d|2[0-6])\b/g," ")
    .replace(/\s+(?:kentucky\s+)?(?:straight\s+)?bourbon\s+(?:whisky|whiskey)\s*$/i," ")
    .replace(/\s+bourbon\s*$/i," ")
    .replace(/\s+(?:whisky|whiskey)\s*$/i," ")
    .replace(/\(\s*\)/g," ")
    .replace(/\s+/g," ")
    .replace(/\s+([,.)])/g,"$1")
    .replace(/([(])\s+/g,"$1")
    .replace(/[-,:]\s*$/,"")
    .trim();
  return cleaned||original;
}

function number(value){
  const match=String(value??"").replace(",",".").match(/\d+(?:\.\d+)?/);
  return match?Number(match[0]):0;
}

export function catalogIdentityEvidence(record){
  const aliases=(record&&record.aliases||[]).join(" ");
  const name=identityAscii(`${record&&record.name||""} ${aliases}`);
  const declaration=identityAscii(`${record&&record.name||""} ${aliases} ${record&&record.type||""} ${record&&record.category||""}`);
  const recipe=(declaration.match(/\b(?:ob|oe)[skqofv]\b/)||[])[0]||"";
  const age=Number((name.match(/\b(\d{1,2})\s*(?:year|years|yr|yrs|yo)\b/)||[])[1]||0);
  let spirit="";
  if(/\brye\b/.test(declaration)) spirit="rye";
  else if(/\bbourbon\b/.test(declaration)) spirit="bourbon";
  else if(/\btennessee\b/.test(declaration)) spirit="tennessee";
  else if(/\bscotch\b/.test(declaration)) spirit="scotch";
  else if(/\birish\b/.test(declaration)) spirit="irish";
  else if(/\bcanadian\b/.test(declaration)) spirit="canadian";
  else if(/\bcorn\b/.test(declaration)) spirit="corn";
  else if(/\bmalt\b/.test(declaration)) spirit="malt";
  else if(/\bwheat\b|\bwheated\b/.test(declaration)) spirit="wheat";
  return {
    spirit,recipe,age,proof:number(record&&record.proof),
    flags:{
      bonded:/\bbonded\b|\bbottled in bond\b|\bbib\b/.test(declaration),
      single_barrel:/\bsingle barrel\b|\bsingle cask\b|\bs b\b|\bprivate selection\b|\bprivate pick\b|\bstore pick\b|\bbarrel program\b/.test(declaration),
      barrel_proof:/\bbarrel proof\b|\bcask strength\b|\bfull proof\b/.test(declaration),
      finished:/\bfinish(?:ed)?\b|\bsherry cask\b|\bport cask\b/.test(declaration),
      double_oaked:/\bdouble oak(?:ed)?\b|\bdouble barrel(?:ed)?\b/.test(declaration),
      flavored:/\bflavou?red\b|\bliqueur\b/.test(declaration)
    }
  };
}

export function catalogRecordsCompatible(left,right){
  const a=catalogIdentityEvidence(left),b=catalogIdentityEvidence(right);
  if(a.spirit&&b.spirit&&a.spirit!==b.spirit) return false;
  if((!a.spirit&&b.spirit&&b.spirit!=="bourbon")||(!b.spirit&&a.spirit&&a.spirit!=="bourbon")) return false;
  if(a.recipe&&b.recipe&&a.recipe!==b.recipe) return false;
  if(a.age&&b.age&&a.age!==b.age) return false;
  const variableProof=a.flags.single_barrel||b.flags.single_barrel||a.flags.barrel_proof||b.flags.barrel_proof;
  if(!variableProof&&a.proof&&b.proof&&Math.abs(a.proof-b.proof)>2) return false;
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

const PRODUCT_FAMILY_RULES=[
  {
    key:"jack-daniels-bonded",
    id:"jack-daniel-s-bonded-119-43",
    name:"Jack Daniel's Bonded",
    proof:100,
    category:"Bottled in Bond",
    nameTest:/^jack daniels bonded$/,
    test:/\bjack daniels\b.*\bbonded\b/
  },
  {
    key:"michters-us1-small-batch-bourbon",
    id:"michters-bourbon",
    name:"Michter's US*1 Small Batch Bourbon",
    spirit:"bourbon",
    proof:91.4,
    category:"Small Batch",
    nameTest:/^michters (?:us 1 )?(?:small batch )?bourbon$/,
    test:/\bmichters\b.*\bbourbon\b/
  },
  {
    key:"michters-us1-original-sour-mash",
    id:"michter-s-us-1-original-sour-mash-small-batch",
    name:"Michter's US*1 Original Sour Mash Whiskey",
    proof:86,
    nameTest:/^michters us ?1 original sour mash small batch$|^michters us ?1 sour mash whiskey$/,
    test:/\bmichters\b.*\bsour mash\b/
  },
  {
    key:"michters-10-year-single-barrel-bourbon",
    id:"michters-single-barrel-10-year-old-bourbon",
    name:"Michter's 10 Year Single Barrel Bourbon",
    category:"Pojedyncza beczka",
    test:/\bmichters?\b.*\b10\b.*\b(?:year|years|yr|yrs)\b.*\bbourbon\b|\bmichters?\b.*\bbourbon\b.*\b10\b.*\b(?:year|years|yr|yrs)\b/
  },
  {
    key:"michters-us1-toasted-barrel-finish-bourbon",
    id:"michters-us-1-toasted-barrel-finish-bourbon-whiskey-2021-release",
    name:"Michter's US*1 Toasted Barrel Finish Bourbon",
    test:/\bmichters?\b.*\bus ?1\b.*\btoasted barrel finish\b|\bmichters?\b.*\btoasted barrel finish\b/
  },
  {
    key:"knob-creek-9-year-standard-bourbon",
    id:"knob-creek-9-year-old-100-proof-bourbon",
    name:"Knob Creek 9 Year Bourbon",
    spirit:"bourbon",
    proof:100,
    category:"Standard",
    nameTest:/^knob creek(?: 9 year(?: old)?(?: 100 proof)?(?: bourbon)?)?(?: 100 proof kentucky straight bourbon whiskey)?$|^knob creek 9 year usa 250th anniversary bourbon limited edition$|^knob creek w glasses$/,
    test:/\bknob creek\b/
  },
  {
    key:"knob-creek-9-year-single-barrel-reserve",
    id:"knob-creek-120-proof-9-year-single-barrel-reserve-bourbon",
    name:"Knob Creek 9 Year Single Barrel Reserve",
    proof:120,
    category:"Pojedyncza beczka",
    test:/\bknob creek\b.*(?:\bsingle barrel select\b|\bsingle barrel reserve\b|\bsdbb\b|\bbold pick\b)/
  },
  {
    key:"knob-creek-7-year-rye",
    id:"olcc-1159b",
    name:"Knob Creek 7 Year Rye",
    spirit:"rye",
    proof:100,
    category:"Rye",
    nameTest:/^knob creek$|^knob creek rye(?: 7 (?:year|yr))?(?: w glasses)?$/,
    test:/\bknob creek\b/
  },
  {
    key:"stagg-kentucky-straight-bourbon",
    id:"stagg-jr",
    name:"Stagg Kentucky Straight Bourbon",
    category:"Barrel Proof",
    test:/\bstagg\b.*\b(?:batch\s*)?(?:1[89]|2[2-9])[a-z]?\b.*\bproof\b|\bstagg kentucky straight bourbon\b.*\bbatch\b/
  },
  {
    key:"colonel-eh-taylor-jr-barrel-proof",
    id:"colonel-e-h-taylor-jr-barrel-proof",
    name:"Colonel E.H. Taylor, Jr. Barrel Proof",
    category:"Barrel Proof",
    test:/\bcolonel e h taylor\b.*\bbarrel proof\b/
  },
  {
    key:"bombergers-declaration",
    id:"bomberger-s-declaration-kentucky-straight-bourbon-whiskey",
    name:"Bomberger's Declaration Bourbon",
    test:/\bbombergers declaration\b/
  },
  {
    key:"makers-mark-cellar-aged",
    id:"makers-mark-cellar-aged-whisky",
    name:"Maker's Mark Cellar Aged",
    test:/\bmakers mark\b.*\bcellar aged\b/
  },
  {
    key:"woodford-reserve-standard",
    id:"woodford-reserve-bourbon",
    name:"Woodford Reserve Bourbon",
    test:/\bwoodford reserve\b.*(?:\bkentucky derby\b|\bholiday (?:edition|select)\b|\bderby \d+\b)/
  },
  {
    key:"buffalo-trace-standard",
    id:"buffalo-trace-bourbon-1",
    name:"Buffalo Trace Bourbon",
    proof:90,
    category:"Standard",
    nameTest:/^buffalo trace(?: bourbon)?(?: single(?: barrel)?)?(?: 032)?(?: select by wooden cork)?$/,
    test:/\bbuffalo trace\b/
  },
  {
    key:"four-roses-single-barrel",
    id:"four-roses-obsk-single-barrel-bourbon",
    name:"Four Roses Single Barrel",
    proof:100,
    category:"Pojedyncza beczka",
    nameTest:/^four roses (?:(?:obsf|obsk|oesk|oeso)(?: single barrel(?: bourbon)?)?(?: hotel covington pick| kroger pick)?(?: \d+(?: \d+)? proof)?|single barrel(?: kentucky bourbn)?(?: (?:obsf|obsk|oesk|oeso))?|s b barrel strength)$/,
    test:/\bfour roses\b.*(?:\bobsf\b|\bobsk\b|\boesk\b|\boeso\b|\bsingle barrel\b|\bs b barrel strength\b)/
  },
  {
    key:"weller-full-proof",
    id:"w-l-weller-full-proof-bourbon-single-barrel-select-by-wooden-cork",
    name:"W. L. Weller Full Proof Bourbon",
    category:"Barrel Proof",
    test:/\bw l weller\b.*\bfull proof\b.*\bsingle barrel\b/
  },
  {
    key:"blantons-gold-edition",
    id:"blanton-s-gold-edition-single-barrel-select",
    name:"Blanton's Gold Edition Single Barrel",
    category:"Pojedyncza beczka",
    test:/\bblantons\b.*\bgold edition\b.*\bsingle barrel select\b/
  }
];

function annualReleaseName(value){
  return String(value||"")
    .replace(/\((?:20\d{2}\s+)?release\)/ig," ")
    .replace(/\b20\d{2}\b/g," ")
    .replace(/\b(?:first|second|third|fourth)\s+release\b/ig," ")
    .replace(/\b(?:annual\s+)?release\b/ig," ")
    .replace(/\b(?:vintage|bottling)\b/ig," ")
    .replace(/\bbatch\s*(?:no\.?\s*)?(?:\d{1,2}[a-z]?|\d{2,3}(?:\.\d+)?)\b/ig," ")
    .replace(/\b\d{2,3}(?:\.\d+)?\s*proof\b/ig," ")
    .replace(/\s+/g," ")
    .replace(/\s+([,.)])/g,"$1")
    .replace(/([(])\s+/g,"$1")
    .replace(/[-,:]\s*$/,"")
    .trim();
}

export function catalogProductFamily(record){
  const normalized=identityAscii([
    record&&record.name,
    ...(record&&record.aliases||[]),
    record&&record.type,
    record&&record.category
  ].filter(Boolean).join(" "));
  if(!normalized) return null;
  const name=identityAscii(record&&record.name);
  const evidence=catalogIdentityEvidence(record);
  const known=PRODUCT_FAMILY_RULES.find((rule)=>
    rule.test.test(normalized)&&
    (!rule.nameTest||rule.nameTest.test(name))&&
    (!rule.spirit||!evidence.spirit||rule.spirit===evidence.spirit)
  );
  if(known) return known;
  const hasReleaseMarker=/\b20\d{2}\b|\bbatch\b|\b(?:annual|first|second|third|fourth)\s+release\b|\bvintage\b/i.test(String(record&&record.name||""));
  if(!hasReleaseMarker) return null;
  const displayName=annualReleaseName(record.name);
  const key=catalogIdentityKey(displayName)
    .replace(/\b(?:edition|limited|commemorative|anniversary)\b/g," ")
    .replace(/\s+/g," ")
    .trim();
  if(!key || key===catalogIdentityKey(record.name)) return null;
  return {key:"annual:"+key,name:displayName};
}

function mergeRedirects(redirects, additions){
  const out={...(redirects||{}),...(additions||{})};
  for(const source of Object.keys(out)){
    const seen=new Set([source]);
    let target=out[source];
    while(target&&out[target]&&!seen.has(target)){
      seen.add(target);
      target=out[target];
    }
    if(target) out[source]=target;
  }
  return out;
}

export function consolidateCatalogProducts(records, previousRedirects={}){
  const groups=new Map();
  const passthrough=[];
  (records||[]).forEach((record,index)=>{
    const family=catalogProductFamily(record);
    if(!family){ passthrough.push({record,index}); return; }
    if(!groups.has(family.key)) groups.set(family.key,{family,items:[]});
    groups.get(family.key).items.push({record,index});
  });
  for(const group of groups.values()){
    if(!group.family.id) continue;
    const targetIndex=passthrough.findIndex((item)=>item.record&&item.record.id===group.family.id);
    if(targetIndex>=0) group.items.unshift(passthrough.splice(targetIndex,1)[0]);
  }
  const output=[...passthrough];
  const redirects={};
  const mergedGroups=[];
  for(const {family,items} of groups.values()){
    if(items.length<2 && !family.id){
      output.push(items[0]);
      continue;
    }
    const preferred=items.find((item)=>item.record.id===family.id);
    const result=mergeCluster(preferred?[preferred,...items.filter((item)=>item!==preferred)]:items);
    const canonical={...result.record};
    if(family.id) canonical.id=family.id;
    if(family.name) canonical.name=family.name;
    if(family.category) canonical.category=family.category;
    if(Number.isFinite(family.proof)) canonical.proof=family.proof;
    canonical.aliases=[...new Set(items.flatMap((item)=>[item.record.name,...(item.record.aliases||[])]).concat(canonical.aliases||[]).filter(Boolean))];
    output.push({record:canonical,index:Math.min(...items.map((item)=>item.index))});
    for(const item of items){
      if(item.record.id&&item.record.id!==canonical.id) redirects[item.record.id]=canonical.id;
    }
    if(items.length>1){
      mergedGroups.push({
        family_key:family.key,
        canonical_id:canonical.id,
        canonical_name:canonical.name,
        merged_ids:items.map((item)=>item.record.id).filter((id)=>id&&id!==canonical.id)
      });
    }
  }
  output.sort((a,b)=>a.index-b.index);
  return {
    records:output.map((item)=>item.record),
    redirects:mergeRedirects(previousRedirects,redirects),
    groups:mergedGroups,
    removed:Object.keys(redirects).length
  };
}

export function dedupeCatalogRecords(records){
  let renamed=0;
  function withDisplayName(record){
    const name=catalogProductDisplayName(record&&record.name);
    if(!name||name===record.name) return record;
    renamed++;
    return {
      ...record,
      name,
      aliases:[...new Set([record.name,...(record.aliases||[])].filter(Boolean))]
    };
  }
  const keyed=new Map();
  (records||[]).forEach((record,index)=>{
    const key=catalogProductIdentityKey(record&&record.name);
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
      result.record=withDisplayName(result.record);
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
  (records||[]).forEach((record,index)=>{ if(!consumed.has(index)) output.push({record:withDisplayName(record),index}); });
  output.sort((a,b)=>a.index-b.index);
  return {
    records:output.map((item)=>item.record),
    redirects,
    groups:mergedGroups,
    removed:Object.keys(redirects).length,
    renamed
  };
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
