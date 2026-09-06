import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const manifestPath=path.join(root,"db","catalog","demo-image-manifest.json");
const overridesPath=path.join(root,"db","catalog","demo-image-overrides.json");
const outputDir=path.join(root,"assets","bourbons","demo-200");
const reportPath=path.join(root,"db","catalog","demo-image-fetch-report.json");
const reviewPath=path.join(root,"db","catalog","demo-image-review.json");
const only=String(process.env.BH_IMAGE_ONLY||"").trim().toLowerCase();
const limit=Math.max(1,Number(process.env.BH_IMAGE_LIMIT)||250);

const SOURCE_RULES=[
  [/^(Jim Beam|Old Grand-Dad|Basil Hayden|Knob Creek|Booker's|Baker's|Legent)/i,["https://www.jimbeam.com"]],
  [/^Maker's Mark/i,["https://www.makersmark.com"]],
  [/^Evan Williams/i,["https://evanwilliams.com"]],
  [/^(Larceny|Henry McKenna|Heaven Hill|Elijah Craig|Rittenhouse)/i,["https://heavenhilldistillery.com","https://elijahcraig.com","https://larcenybourbon.com"]],
  [/^Bulleit/i,["https://www.bulleit.com"]],
  [/^Four Roses/i,["https://www.fourrosesbourbon.com"]],
  [/^Wild Turkey/i,["https://www.wildturkeybourbon.com"]],
  [/^Old Forester/i,["https://www.oldforester.com"]],
  [/^1792/i,["https://www.1792bourbon.com"]],
  [/^(Benchmark|Weller|E\.H\. Taylor|Sazerac Rye)/i,["https://www.buffalotracedistillery.com"]],
  [/^Angel's Envy/i,["https://www.angelsenvy.com"]],
  [/^Rabbit Hole/i,["https://www.rabbitholedistillery.com"]],
  [/^New Riff/i,["https://www.newriffdistilling.com"]],
  [/^Wilderness Trail/i,["https://wildernesstraildistillery.com"]],
  [/^Green River/i,["https://greenriverwhiskey.com"]],
  [/^Bardstown Bourbon/i,["https://www.bardstownbourbon.com"]],
  [/^Penelope/i,["https://penelopebourbon.com"]],
  [/^Redwood Empire/i,["https://redwoodempirewhiskey.com"]],
  [/^Smoke Wagon/i,["https://nevadahdistilling.com"]],
  [/^High West/i,["https://www.highwest.com"]],
  [/^Horse Soldier/i,["https://horsesoldierbourbon.com"]],
  [/^Early Times/i,["https://www.earlytimes.com"]],
  [/^Coopers' Craft/i,["https://www.cooperscraft.com"]],
  [/^Bowman Brothers/i,["https://www.asmithbowman.com"]],
  [/^Johnnie Walker/i,["https://www.johnniewalker.com"]],
  [/^Chivas Regal/i,["https://www.chivas.com"]],
  [/^Ballantine/i,["https://www.ballantines.com"]],
  [/^Grant's/i,["https://www.grantswhisky.com"]],
  [/^Dewar's/i,["https://www.dewars.com"]],
  [/^J&B/i,["https://www.jandbscotch.com"]],
  [/^The Famous Grouse/i,["https://www.thefamousgrouse.com"]],
  [/^Cutty Sark/i,["https://cutty-sark.com"]],
  [/^Monkey Shoulder/i,["https://www.monkeyshoulder.com"]],
  [/^Glenfiddich/i,["https://www.glenfiddich.com"]],
  [/^The Glenlivet/i,["https://www.theglenlivet.com"]],
  [/^The Macallan/i,["https://www.themacallan.com"]],
  [/^The Balvenie/i,["https://www.thebalvenie.com"]],
  [/^Glenmorangie/i,["https://www.glenmorangie.com"]],
  [/^Aberlour/i,["https://www.aberlour.com"]],
  [/^Ardbeg/i,["https://www.ardbeg.com"]],
  [/^Laphroaig/i,["https://www.laphroaig.com"]],
  [/^(Lagavulin|Talisker|Oban|Caol Ila|Dalwhinnie)/i,["https://www.malts.com"]],
  [/^Highland Park/i,["https://www.highlandparkwhisky.com"]],
  [/^Bunnahabhain/i,["https://bunnahabhain.com"]],
  [/^Bowmore/i,["https://www.bowmore.com"]],
  [/^The Dalmore/i,["https://www.thedalmore.com"]],
  [/^The GlenDronach/i,["https://www.glendronachdistillery.com"]],
  [/^The GlenAllachie/i,["https://theglenallachie.com"]],
  [/^Bruichladdich/i,["https://www.bruichladdich.com"]],
  [/^Auchentoshan/i,["https://www.auchentoshan.com"]],
  [/^Jura/i,["https://www.jurawhisky.com"]],
  [/^Jameson/i,["https://www.jamesonwhiskey.com"]],
  [/^Tullamore/i,["https://www.tullamoredew.com"]],
  [/^Bushmills/i,["https://www.bushmills.com"]],
  [/^Redbreast/i,["https://www.redbreastwhiskey.com"]],
  [/^(Green Spot|Yellow Spot)/i,["https://www.spotwhiskey.com"]],
  [/^Powers/i,["https://www.powerswhiskey.com"]],
  [/^Teeling/i,["https://www.teelingwhiskey.com"]],
  [/^Proper No\. Twelve/i,["https://properwhiskey.com"]],
  [/^(Suntory|Hibiki|Yamazaki|Hakushu)/i,["https://house.suntory.com"]],
  [/^Nikka/i,["https://www.nikka.com"]],
  [/^Mars Iwai/i,["https://www.hombo.co.jp"]],
  [/^Akashi/i,["https://akashisakebrewery.com"]],
  [/^Hatozaki/i,["https://hatozakiwhisky.com"]],
  [/^(Jack Daniel's|Gentleman Jack)/i,["https://www.jackdaniels.com"]],
  [/^George Dickel/i,["https://www.georgedickel.com"]],
  [/^WhistlePig/i,["https://whistlepigwhiskey.com"]],
  [/^Crown Royal/i,["https://www.crownroyal.com"]],
  [/^Canadian Club/i,["https://www.canadianclub.com"]]
];

const GENERIC=new Set("the whisky whiskey kentucky straight proof year years old label edition scotch irish japanese canadian".split(" "));
const QUERY_ALIASES=new Map([
  ["popular-bulleit-bourbon","Bulleit Bourbon"]
]);
const PAGE_HINTS=new Map([
  ["popular-chivas-regal-12-year",["https://www.chivas.com/en/collection/chivas-12/"]],
  ["popular-chivas-regal-18-year",["https://www.chivas.com/en/collection/chivas-regal-18/"]],
  ["popular-jameson-irish-whiskey",["https://www.jamesonwhiskey.com/en-us/our-whiskey/jameson-irish-whiskey/"]],
  ["popular-jameson-black-barrel",["https://www.jamesonwhiskey.com/en-us/our-whiskey/jameson-black-barrel/"]],
  ["popular-jameson-caskmates-stout-edition",["https://www.jamesonwhiskey.com/en/our-whiskey/jameson-stout-edition/"]],
  ["bushmills-original-irish-whiskey",["https://bushmills.com/products/the-original"]],
  ["bushmills-black-bush-irish-whiskey",["https://bushmills.com/products/black-bush"]],
  ["bushmills-10-year-old-single-malt",["https://bushmills.com/products/10-year"]],
  ["bushmills-16-year-old-single-malt",["https://bushmills.com/products/16-year"]],
  ["popular-redbreast-12-year",["https://www.redbreastwhiskey.com/en-us/whiskey-collections/redbreast-12-year-old/"]],
  ["popular-redbreast-15-year",["https://www.redbreastwhiskey.com/en-us/whiskey-collections/redbreast-15-year-old/"]],
  ["popular-redbreast-12-year-cask-strength",["https://www.redbreastwhiskey.com/en-us/whiskey-collections/redbreast-12-year-old-cask-strength/"]],
  ["popular-green-spot",["https://www.spotwhiskey.com/en-us/whiskeys/green-spot/"]],
  ["popular-yellow-spot-12-year",["https://www.spotwhiskey.com/en-us/whiskeys/yellow-spot/"]],
  ["popular-powers-gold-label",["https://www.powerswhiskey.com/en-us/our-whiskeys"]],
  ["popular-powers-three-swallow",["https://www.powerswhiskey.com/en-us/our-whiskeys"]],
  ["popular-nikka-from-the-barrel",["https://www.nikka.com/en/brands/"]],
  ["olcc-2619b",["https://www.nikka.com/en/brands/"]],
  ["olcc-4087b",["https://www.nikka.com/en/brands/"]],
  ["popular-nikka-days",["https://www.nikka.com/en/brands/"]],
  ["popular-nikka-yoichi-single-malt",["https://www.nikka.com/en/brands/"]],
  ["popular-nikka-miyagikyo-single-malt",["https://www.nikka.com/en/brands/"]],
  ["popular-ardbeg-10-year",["https://www.ardbeg.com/en-int/products/ardbeg-ten-years-old"]],
  ["popular-the-macallan-12-year-double-cask",["https://www.themacallan.com/en/single-malt-scotch-whisky/double-cask-12-years-old"]],
  ["popular-the-macallan-12-year-sherry-oak",["https://www.themacallan.com/en/single-malt-scotch-whisky/sherry-oak-12-years-old"]],
  ["popular-the-macallan-15-year-double-cask",["https://www.themacallan.com/en/single-malt-scotch-whisky/double-cask-15-years-old"]]
]);
const PAGE_BLOCKLIST=/cocktail|recipe|whiskey-drinks|drink|story|stories|news|blog|visit|shop|merch|faq|press|event|podcast/i;
const IMAGE_BLOCKLIST=/logo|icon|cocktail|recipe|serve|social|footer|header-logo|award|distillery|people|person|interview|youtube|thumbnail/i;
const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
const decode=(value)=>String(value||"").replace(/&amp;/g,"&").replace(/&#0*39;|&apos;/g,"'").replace(/&quot;/g,'"');
const norm=(value)=>String(value||"").normalize("NFKD").toLowerCase().replace(/([0-9])([a-z])/g,"$1 $2").replace(/([a-z])([0-9])/g,"$1 $2").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
const onlyTerms=only.split("|").map((value)=>norm(value)).filter(Boolean);
const tokens=(value)=>norm(value).split(" ").filter((token)=>token && (!GENERIC.has(token) || /^\d+$/.test(token)));
const safeName=(value)=>String(value||"").replace(/[^a-z0-9._-]+/gi,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").toLowerCase();
const unique=(values)=>Array.from(new Set(values.filter(Boolean)));

async function get(url, binary=false){
  const response=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36 BourbonHuntersDemo/1.0",Accept:binary?"image/webp,image/png,image/jpeg,*/*;q=0.2":"text/html,application/xml;q=0.9,*/*;q=0.5"},redirect:"follow",signal:AbortSignal.timeout(25000)});
  if(!response.ok) throw new Error("HTTP "+response.status);
  return binary?{bytes:Buffer.from(await response.arrayBuffer()),type:response.headers.get("content-type")||"",url:response.url}:{text:await response.text(),type:response.headers.get("content-type")||"",url:response.url};
}

function bingResultTarget(raw){
  try{
    const parsed=new URL(decode(raw),"https://www.bing.com/");
    if(!/(?:^|\.)bing\.com$/i.test(parsed.hostname)) return parsed.href;
    const encoded=parsed.searchParams.get("u")||"";
    if(!encoded.startsWith("a1")) return "";
    return Buffer.from(encoded.slice(2),"base64url").toString("utf8");
  }catch(e){ return ""; }
}

async function searchOfficialProductPages(origin,item){
  const rootHost=new URL(origin).hostname.replace(/^www\./i,"").toLowerCase();
  const query=`site:${rootHost} "${queryName(item)}" whisky bottle`;
  try{
    const response=await get("https://www.bing.com/search?q="+encodeURIComponent(query));
    const pages=[];
    for(const match of response.text.matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1/gi)){
      const target=bingResultTarget(match[2]);
      if(!target) continue;
      try{
        const url=new URL(target);
        const host=url.hostname.replace(/^www\./i,"").toLowerCase();
        if(host===rootHost || host.endsWith("."+rootHost)) pages.push(url.href);
      }catch(e){}
    }
    return unique(pages);
  }catch(e){ return []; }
}

function sitemapLocations(xml){
  return Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi),(match)=>decode(match[1].trim()));
}

async function siteUrls(origin){
  const base=origin.replace(/\/$/,"");
  const queue=[base+"/sitemap.xml"];
  const visited=new Set();
  const pages=[];
  try{
    const robots=await get(base+"/robots.txt");
    for(const match of robots.text.matchAll(/^sitemap:\s*(\S+)/gim)) queue.push(match[1]);
  }catch(e){}
  while(queue.length && visited.size<36){
    const sitemap=queue.shift();
    if(visited.has(sitemap)) continue;
    visited.add(sitemap);
    try{
      const {text}=await get(sitemap);
      const locations=sitemapLocations(text);
      for(const location of locations){
        if(/\.xml(?:\?|$)/i.test(location)){
          if(!/blog|cocktail|recipe|news|event|press|tag|author/i.test(location) && queue.length<36) queue.push(location);
        }else if(location.startsWith(origin)) pages.push(location);
      }
    }catch(e){}
  }
  try{
    const homepage=await get(base+"/");
    const links=[];
    for(const match of homepage.text.matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1/gi)){
      try{
        const link=new URL(decode(match[2]),homepage.url).href;
        if(link.startsWith(base) && /product|whisk|bourbon|range|spirit|our-/i.test(link) && !PAGE_BLOCKLIST.test(link)) links.push(link);
      }catch(e){}
    }
    pages.push(...links);
    for(const landing of unique(links).slice(0,8)){
      try{
        const response=await get(landing);
        for(const match of response.text.matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1/gi)){
          const link=new URL(decode(match[2]),response.url).href;
          if(link.startsWith(base) && /product|whisk|bourbon|range|spirit/i.test(link) && !PAGE_BLOCKLIST.test(link)) pages.push(link);
        }
      }catch(e){}
    }
  }catch(e){}
  return unique(pages);
}

function queryName(item){
  return QUERY_ALIASES.get(item.id)||item.name;
}

function pageScore(url,item){
  let text="";
  try{text=norm(decodeURIComponent(new URL(url).pathname));}catch(e){return -100;}
  if(PAGE_BLOCKLIST.test(text)) return -100;
  const wanted=tokens(queryName(item));
  let score=0;
  let matched=0;
  wanted.forEach((token,index)=>{ if(new RegExp("(?:^| )"+token+"(?: |$)").test(text)){ matched+=1; score+=(/^\d+$/.test(token)?8:4)+(index*0.5); } });
  const numbers=norm(queryName(item)).match(/\b\d+\b/g)||[];
  numbers.forEach((number)=>{ if(new RegExp("(?:^| )"+number+"(?: |$)").test(text)) score+=8; else score-=5; });
  if(numbers.length===0 && /\b\d+\b/.test(text)) score-=12;
  if(/product|products|whisk|bourbon|our-range|our-whis/i.test(text)) score+=6;
  else score-=6;
  if(matched<Math.min(2,wanted.length)) score-=15;
  return score;
}

function attrs(tag){
  const out={};
  for(const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gs)) out[match[1].toLowerCase()]=decode(match[3]);
  return out;
}

function normalizedImageUrl(raw,pageUrl){
  let url=new URL(decode(raw).split(/\s+/)[0],pageUrl);
  const nested=url.searchParams.get("url");
  if(/\/_next\/image$/i.test(url.pathname) && nested) url=new URL(decodeURIComponent(nested),pageUrl);
  if(url.searchParams.get("fm")==="avif") url.searchParams.set("fm","webp");
  if(url.hostname.endsWith("ctfassets.net")){
    url.searchParams.set("fm","webp");
    url.searchParams.set("w","1200");
    url.searchParams.set("q","85");
  }
  return url.href;
}

function imageCandidates(html,pageUrl,item){
  const out=[];
  const add=(raw,label,kind)=>{
    if(!raw || /data:image|\.svg(?:\?|$)/i.test(raw)) return;
    let url=""; try{url=normalizedImageUrl(raw,pageUrl);}catch(e){return;}
    if(!/^https?:/i.test(url)) return;
    const hay=norm(url+" "+label);
    let score=0;
    let matched=0;
    tokens(queryName(item)).forEach((token)=>{ if(new RegExp("(?:^| )"+token+"(?: |$)").test(hay)){ matched+=1; score+=/^\d+$/.test(token)?8:4; } });
    if(/bottle|packshot|front/.test(hay)) score+=14;
    else if(/product|hero/.test(hay)) score+=4;
    if(kind==="jsonld") score+=5;
    if(kind==="og") score+=2;
    if(IMAGE_BLOCKLIST.test(hay)) score-=30;
    out.push({url,label,kind,score,hay,matched});
  };
  for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){
    const a=attrs(tag),key=String(a.property||a.name||"").toLowerCase();
    if(key==="og:image" || key==="twitter:image") add(a.content,"", "og");
  }
  for(const tag of html.match(/<img\b[^>]*>/gi)||[]){
    const a=attrs(tag),srcset=String(a.srcset||a["data-srcset"]||"");
    const largestSrcset=srcset?srcset.split(",").at(-1).trim().split(/\s+/)[0]:"";
    const raw=a["data-imgsrc"]||a["data-src"]||a["data-lazy-src"]||largestSrcset||a.src;
    add(raw,a.alt||a.title||"","img");
  }
  for(const match of html.matchAll(/"image"\s*:\s*(?:\[\s*)?"(https?:\\?\/\\?\/[^"\\]+(?:\\.[^"\\]+)*)"/gi)) add(match[1].replace(/\\\//g,"/"),"","jsonld");
  for(const tag of html.match(/<source\b[^>]*>/gi)||[]){
    const a=attrs(tag),srcset=String(a.srcset||a["data-srcset"]||"");
    const raw=srcset?srcset.split(",").at(-1).trim().split(/\s+/)[0]:a.src;
    add(raw,a.alt||a.title||"","source");
  }
  for(const match of html.matchAll(/url\(\s*(["']?)(https?:\/\/[^)'"\s]+)\1\s*\)/gi)) add(match[2],"","css");
  for(const match of html.matchAll(/(https?:\\?\/\\?\/[^"'<>\s]+\.(?:webp|png|jpe?g)(?:\?[^"'<>\s\\]*)?)/gi)) add(match[1].replace(/\\\//g,"/"),"","embedded");
  return out.sort((left,right)=>right.score-left.score);
}

function imageDimensions(bytes,type){
  if(/png/i.test(type) && bytes.length>24 && bytes.toString("ascii",1,4)==="PNG") return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
  if(/jpe?g/i.test(type) || (bytes[0]===0xff && bytes[1]===0xd8)){
    let offset=2;
    while(offset+9<bytes.length){
      if(bytes[offset]!==0xff){ offset+=1; continue; }
      const marker=bytes[offset+1];
      const length=bytes.readUInt16BE(offset+2);
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) return {height:bytes.readUInt16BE(offset+5),width:bytes.readUInt16BE(offset+7)};
      if(length<2) break;
      offset+=2+length;
    }
  }
  if(bytes.length>30 && bytes.toString("ascii",0,4)==="RIFF" && bytes.toString("ascii",8,12)==="WEBP"){
    const mode=bytes.toString("ascii",12,16);
    if(mode==="VP8X") return {width:1+bytes.readUIntLE(24,3),height:1+bytes.readUIntLE(27,3)};
    if(mode==="VP8 ") return {width:bytes.readUInt16LE(26)&0x3fff,height:bytes.readUInt16LE(28)&0x3fff};
  }
  return null;
}

function bottleLikeDimensions(dimensions){
  if(!dimensions) return true;
  return dimensions.width>=300 && dimensions.height>=400 && dimensions.height/dimensions.width>=0.9;
}

function plainMetadata(value){
  return String(value&&value.value||value||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}

async function commonsImage(item){
  const params=new URLSearchParams({
    action:"query",format:"json",generator:"search",gsrnamespace:"6",gsrlimit:"12",
    gsrsearch:tokens(queryName(item)).join(" "),
    prop:"imageinfo",iiprop:"url|size|mime|extmetadata",iiurlwidth:"1200"
  });
  try{
    const response=await get("https://commons.wikimedia.org/w/api.php?"+params);
    const payload=JSON.parse(response.text);
    const wanted=tokens(queryName(item));
    const wantedNumbers=norm(queryName(item)).match(/\b\d+\b/g)||[];
    const candidates=Object.values(payload.query&&payload.query.pages||{}).map((page)=>{
      const info=page.imageinfo&&page.imageinfo[0]||{};
      const title=norm(String(page.title||"").replace(/^file:/i,""));
      const matched=wanted.filter((token)=>new RegExp("(?:^| )"+token+"(?: |$)").test(title));
      const numberMatch=wantedNumbers.every((number)=>new RegExp("(?:^| )"+number+"(?: |$)").test(title));
      const license=plainMetadata(info.extmetadata&&info.extmetadata.LicenseShortName);
      let score=matched.length*6+(numberMatch?8:0);
      if(/bottle|whisk|bourbon|scotch|irish/.test(title)) score+=5;
      if(IMAGE_BLOCKLIST.test(title)) score-=30;
      const titleLength=title.split(" ").filter(Boolean).length;
      const beverageCue=/bottle|whisk|bourbon|scotch|rye/.test(title);
      const compactTitle=titleLength<=wanted.length+3;
      return {page,info,title,license,matched:matched.length,numberMatch,score,beverageCue,compactTitle};
    }).filter((candidate)=>{
      const enoughTokens=candidate.matched>=Math.min(2,wanted.length) && candidate.matched/Math.max(1,wanted.length)>=0.55;
      return enoughTokens && candidate.numberMatch && candidate.beverageCue && /^image\/(?:jpeg|png|webp)$/i.test(candidate.info.mime||"") && /^(?:CC0|Public domain|CC BY(?:-SA)?(?: |$))/i.test(candidate.license);
    }).sort((left,right)=>right.score-left.score);
    for(const candidate of candidates){
      const downloaded=await get(candidate.info.thumburl||candidate.info.url,true);
      const dimensions={width:Number(candidate.info.thumbwidth||candidate.info.width)||0,height:Number(candidate.info.thumbheight||candidate.info.height)||0};
      if(downloaded.bytes.length<12000 || !bottleLikeDimensions(dimensions)) continue;
      const metadata=candidate.info.extmetadata||{};
      return {
        page_url:candidate.info.descriptionurl||"https://commons.wikimedia.org/wiki/"+encodeURIComponent(candidate.page.title||""),
        image_url:downloaded.url,bytes:downloaded.bytes,type:downloaded.type,score:candidate.score,dimensions,
        source_type:"wikimedia_commons",license_status:candidate.license,
        attribution:plainMetadata(metadata.Artist)||plainMetadata(metadata.Credit),
        license_url:plainMetadata(metadata.LicenseUrl)
      };
    }
  }catch(e){}
  return null;
}

function extension(type,url){
  if(/webp/i.test(type)) return ".webp";
  if(/png/i.test(type)) return ".png";
  if(/jpe?g/i.test(type)) return ".jpg";
  const ext=(new URL(url).pathname.match(/\.(webp|png|jpe?g)$/i)||[])[1];
  return ext?"."+ext.toLowerCase().replace("jpeg","jpg"):".jpg";
}

const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));
const previous=fs.existsSync(overridesPath)?JSON.parse(fs.readFileSync(overridesPath,"utf8").replace(/^\uFEFF/,"")):{version:"official-demo-images-v1",items:{}};
const overrides=previous.items||{};
const review=fs.existsSync(reviewPath)?JSON.parse(fs.readFileSync(reviewPath,"utf8").replace(/^\uFEFF/,"")):{rejected:{}};
const rejectedIds=new Set(Object.keys(review.rejected||{}));
const missing=(manifest.items||[]).filter((item)=>item.status==="missing" && !rejectedIds.has(item.id) && (!onlyTerms.length || onlyTerms.some((term)=>norm(item.name).includes(term)))).slice(0,limit);
const domainCache=new Map();
const report={version:"official-demo-images-v1",started_at:new Date().toISOString(),requested:missing.length,downloaded:[],skipped:[],failed:[]};
fs.mkdirSync(outputDir,{recursive:true});

for(const [index,item] of missing.entries()){
  const rule=SOURCE_RULES.find(([pattern])=>pattern.test(item.name));
  if(!rule){ report.skipped.push({id:item.id,name:item.name,reason:"official_domain_missing"}); continue; }
  let resolved=null;
  for(const origin of rule[1]){
    let pages=domainCache.get(origin);
    if(!pages){ pages=await siteUrls(origin); domainCache.set(origin,pages); await sleep(200); }
    const hints=PAGE_HINTS.get(item.id)||[];
    const searched=await searchOfficialProductPages(origin,item);
    const searchedSet=new Set(searched);
    const hintSet=new Set(hints);
    const ranked=unique([...hints,...searched,...pages]).map((url)=>({url,score:pageScore(url,item),searched:searchedSet.has(url),hinted:hintSet.has(url)})).filter((row)=>{
      if(row.score>=8 || row.searched || row.hinted) return true;
      try{return /collection|products?|our-whisk(?:y|ey)|whiskies|bourbons?|range|spirits?/i.test(new URL(row.url).pathname);}catch(e){return false;}
    }).sort((a,b)=>b.score-a.score).slice(0,14);
    for(const page of ranked){
      try{
        const response=await get(page.url);
        const numbers=norm(queryName(item)).match(/\b\d+\b/g)||[];
        const exactPage=page.score>=8 || page.hinted;
        const wanted=tokens(queryName(item));
        const images=imageCandidates(response.text,response.url,item).filter((image)=>{
          if(image.score<(exactPage?6:18)) return false;
          if(exactPage) return true;
          const enoughTokens=image.matched>=Math.min(2,wanted.length) && image.matched/Math.max(1,wanted.length)>=0.8;
          return enoughTokens && numbers.every((number)=>new RegExp("(?:^| )"+number+"(?: |$)").test(image.hay));
        }).slice(0,10);
        for(const candidate of images){
          const downloaded=await get(candidate.url,true);
          if(downloaded.bytes.length<12000 || !/^image\//i.test(downloaded.type)) continue;
          const dimensions=imageDimensions(downloaded.bytes,downloaded.type);
          if(!bottleLikeDimensions(dimensions)) continue;
          resolved={page_url:response.url,image_url:downloaded.url,bytes:downloaded.bytes,type:downloaded.type,score:candidate.score,dimensions};
          break;
        }
        if(resolved) break;
      }catch(e){}
    }
    if(resolved) break;
  }
  if(!resolved) resolved=await commonsImage(item);
  if(!resolved){
    report.failed.push({id:item.id,name:item.name,reason:"official_product_image_not_resolved"});
  }else{
    const ext=extension(resolved.type,resolved.image_url);
    const relative="assets/bourbons/demo-200/"+safeName(item.id)+ext;
    fs.writeFileSync(path.join(root,relative),resolved.bytes);
    overrides[item.id]={
      image:relative,source_page:resolved.page_url,source_url:resolved.image_url,
      source_type:resolved.source_type||"official_brand_website",
      license_status:resolved.license_status||"official_source_review_required",
      fetched_at:new Date().toISOString()
    };
    if(resolved.attribution) overrides[item.id].attribution=resolved.attribution;
    if(resolved.license_url) overrides[item.id].license_url=resolved.license_url;
    report.downloaded.push({id:item.id,name:item.name,image:relative,source_page:resolved.page_url,source_url:resolved.image_url,bytes:resolved.bytes.length,score:resolved.score,dimensions:resolved.dimensions});
  }
  process.stdout.write(`[${index+1}/${missing.length}] ${item.name}: ${resolved?"downloaded":"not found"}\n`);
  await sleep(180);
}

report.completed_at=new Date().toISOString();
report.downloaded_count=report.downloaded.length;
report.failed_count=report.failed.length;
report.skipped_count=report.skipped.length;
fs.writeFileSync(overridesPath,JSON.stringify({version:"official-demo-images-v1",updated:report.completed_at,items:overrides},null,2)+"\n");
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n");
process.stdout.write(JSON.stringify({ok:true,requested:report.requested,downloaded:report.downloaded_count,failed:report.failed_count,skipped:report.skipped_count},null,2)+"\n");
