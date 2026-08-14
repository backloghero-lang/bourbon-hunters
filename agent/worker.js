// Bourbon Hunters - Cloudflare Worker v2 (baza-first + 2 tryby)
//
// Tryb pracy:
//   1) Jeden agent wizualny rozpoznaje dokladna nazwe butelki ze zdjecia.
//   2) Nazwa i wariant sa dopasowywane do aktualnego katalogu.
//   3a) tryb "rate"   -> user potwierdza najlepszy wynik z katalogu.
//   3b) tryb "analyze"-> rozbudowany opis + historia destylarni z linkami (Gemini + Google Search), fakty z bazy jako grunt.
//
// SEKRETY: GEMINI_API_KEY (wymagany)
// ZMIENNE: MODEL, IDENT_MODEL, IDENT_FALLBACK_MODEL, CUTOUT_QA_MODEL, NEWS_MODEL, TEMP_RATE, TEMP_ANALYZE, THINK_ANALYZE, MAX_RATE, MAX_ANALYZE, DAILY_LIMIT, SCAN_IP_DAILY_LIMIT, LOCAL_CUTOUT_DAILY_LIMIT, LOCAL_CUTOUT_IP_DAILY_LIMIT, ANALYZE_DAILY_LIMIT, ANALYZE_IP_DAILY_LIMIT, ALLOW_ORIGIN, PROMPT_URL, DB_URL, APP_URL, GOOGLE_REDIRECT_URI
// SEKRETY OAuth: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, opcjonalnie GOOGLE_STATE_SECRET
// KV: DS_KV (limit + zapis nowosci). Klucze nowosci: "new:<id>".
// D1: DB (konta, sesje, wishlist, kolekcja, oceny).

const REPO = "backloghero-lang/bourbon-hunters";
const DEFAULT_PROMPT_URL = "https://raw.githubusercontent.com/" + REPO + "/main/agent/prompt.txt";
const DEFAULT_DB_URL = "https://raw.githubusercontent.com/" + REPO + "/main/db/catalog/demo-scan-index.json";
const FALLBACK_PROMPT = "Jestes Hunter, kowboj-znawca bourbona z Bourbon Hunters. Krotko, z jajem, ale rzeczowo. quality=jakosc 1-5, value=jakosc/cena 1-5 (5 swietna i tania, 1 slaba i droga). Pisz {{LANG}}. Zwroc tylko JSON.";
const DEFAULT_MATCH_CONFIDENCE = 0.8;
const MULTI_CANDIDATE_CONFIDENCE = 0.9;
const SCAN_ORCHESTRATOR_VERSION = "visual-only-catalog-v9-model-resolver";
const SCAN_CATALOG_VERSION = "demo-200-v1";
const CATALOG_SUBMISSION_VERSION = "community-catalog-images-v6-highres-cutout";
const CATALOG_MODERATION_VERSION = "catalog-moderation-orchestrator-admin-v1";
const CATALOG_LICENSE_VERSION = "catalog-license-2026-07-18-v1";
const TELEMETRY_VERSION = "scanner-telemetry-v1";
const NEWS_AGENT_VERSION = "whisky-news-source-first-v4-cached-thumbnails";
const LOCAL_IMAGE_PIPELINE_VERSION = "local-bottle-cutout-v2-quality-gated";
const NEWS_RETENTION_DAYS = 30;
const CATALOG_SYSTEM_USER_ID = "catalog-system";
const AUTH_VERSION = "auth-rate-limited-pbkdf2-600k-v5";
const SECURITY_VERSION = "xss-url-health-hardening-v1";
const SCANNER_BUDGET_VERSION = "d1-atomic-cost-budgets-v1";
const AUTH_PROTECTION_VERSION = "d1-auth-throttling-v1";
const PRIVATE_BOTTLE_VERSION = "owner-only-private-bottles-v1";
const UGC_MODERATION_VERSION = "comment-reports-blocks-admin-v1";
const PBKDF2_ITERATIONS = 600000;
const LEGACY_PBKDF2_ITERATIONS = 100000;
const AUTH_BODY_MAX_BYTES = 16384;
const PROFILE_BADGE_IDS = ["glass","bottle","barrel","seal","hat","star","distillery","notes","opener","horseshoe"];

let _p = { t:null, at:0 }, _db = { d:null, at:0 }, _communityDb = { d:null, at:0 };
let _geminiModels = { names:null, at:0 };
const SCAN_RECORD_OVERRIDES={
  "jeffersons-very-small-batch-bourbon-whiskey-copy":{aliases:["Jefferson's Bourbon","Jefferson's Blend of Straight Bourbon Whiskey"],abv:41.15},
  "jack-daniel-s-bonded-119-43":{
    aliases:[
      "Jack Daniel's Bonded","Jack Daniels Bonded",
      "Jack Daniel's Bonded Tennessee Whiskey","Jack Daniels Bonded Tennessee Whiskey",
      "Jack Daniel's Bottled in Bond","Jack Daniels Bottled in Bond"
    ],
    proof:100,abv:50,distillery:"Jack Daniel Distillery",type:"Bottled in Bond Tennessee Whiskey",category:"Bottled-in-Bond"
  },
  "olcc-10541i":{scanDisabled:true},
  "jack-daniel-s-single-barrel-select-140-43":{
    aliases:[
      "Jack Daniel's Single Barrel","Jack Daniels Single Barrel",
      "Jack Daniel's Single Barrel Select","Jack Daniels Single Barrel Select",
      "Jack Daniel's Single Barrel Select Tennessee Whiskey","Jack Daniels Single Barrel Select Tennessee Whiskey"
    ],
    proof:94,abv:47,distillery:"Jack Daniel Distillery",type:"Tennessee Whiskey",category:"Single Barrel"
  },
  "olcc-2169b":{scanDisabled:true},
  "olcc-0146b":{
    aliases:["Jack Daniel's Old No. 7","Jack Daniels Old No 7","Jack Daniel's Black Label","Jack Daniels Tennessee Whiskey"],
    proof:80,abv:40,distillery:"Jack Daniel Distillery",type:"Tennessee Whiskey",category:"Tennessee"
  },
  "jim-beam-white-label":{
    aliases:["Jim Beam","Jim Beam Original","Jim Beam White Label","Jim Beam Kentucky Straight Bourbon Whiskey"],
    proof:80,abv:40,distillery:"James B. Beam Distilling Co.",type:"Kentucky Straight Bourbon Whiskey",category:"Straight Bourbon"
  },
  "jim-beam-101-22":{scanDisabled:true},
  "olcc-0133b":{
    aliases:["Jim Beam Black","Jim Beam Black 7 Year","Jim Beam Black Extra Aged"],
    distillery:"James B. Beam Distilling Co.",type:"Kentucky Straight Bourbon Whiskey",category:"Straight Bourbon"
  },
  "jim-beam-black-7-letni":{scanDisabled:true},
  "jim-beam-black-extra-aged-unpacked":{scanDisabled:true},
  "olcc-3982b":{
    aliases:["Jim Beam Double Oak","Jim Beam Double Oaked"],
    distillery:"James B. Beam Distilling Co.",type:"Kentucky Straight Bourbon Whiskey",category:"Double Oaked"
  },
  "olcc-5173b":{scanDisabled:true},
  "knob-creek-9-year-old-100-proof-bourbon":{
    aliases:[
      "Knob Creek 9 Year","Knob Creek 9 Years","Knob Creek 9 Year Old",
      "Knob Creek 9 Year Old Bourbon","Knob Creek Aged 9 Years",
      "Knob Creek Kentucky Straight Bourbon Whiskey Aged 9 Years",
      "Knob Creek 100 Proof 9 Year"
    ],
    proof:100,abv:50,distillery:"Jim Beam Distillery",type:"Kentucky Straight Bourbon Whiskey",category:"Straight Bourbon"
  },
  "knob-creek-kentucky-straight-bourbon":{scanDisabled:true},
  "knob-creek-101-22":{scanDisabled:true},
  "olcc-2163b":{scanDisabled:true}
};
const SCAN_EXTRA_RECORDS=[
  {id:"bushmills-original-irish-whiskey",name:"Bushmills Original",aliases:["Bushmills Original","Bushmills Original Irish Whiskey","Bushmills White Label"],distillery:"Old Bushmills Distillery",region:"Ireland",type:"Blended Irish Whiskey",category:"Irish",proof:80,abv:40,mashbill:null,price:null,quality:null,value:null,notes:"Light fruit, vanilla, honey and warm spice",desc:"A smooth blended Irish whiskey combining malt and grain whiskey.",image:"",source:"manual_official",catalog_status:"verified"},
  {id:"bushmills-black-bush-irish-whiskey",name:"Bushmills Black Bush",aliases:["Bushmills Black Bush","Black Bush","Black Bush Irish Whiskey"],distillery:"Old Bushmills Distillery",region:"Ireland",type:"Blended Irish Whiskey",category:"Irish",proof:80,abv:40,mashbill:null,price:null,quality:null,value:null,notes:"Sherry, dried fruit and toasted nuts",desc:"A malt-forward Irish blend matured in Oloroso sherry and bourbon casks.",image:"",source:"manual_official",catalog_status:"verified"},
  {id:"bushmills-10-year-old-single-malt",name:"Bushmills 10 Year Old Single Malt",aliases:["Bushmills 10 Year","Bushmills 10 Year Old","Bushmills 10 Year Single Malt","Bushmills 10 Year Old Single Malt Irish Whiskey"],distillery:"Old Bushmills Distillery",region:"Ireland",type:"Single Malt Irish Whiskey",category:"Irish",proof:80,abv:40,mashbill:null,price:null,quality:null,value:null,notes:"Apple, honey and milk chocolate",desc:"A ten-year-old triple-distilled Irish single malt.",image:"",source:"manual_official",catalog_status:"verified"},
  {id:"bushmills-12-year-old-single-malt",name:"Bushmills 12 Year Old Single Malt",aliases:["Bushmills 12 Year","Bushmills 12 Year Old","Bushmills 12 Year Single Malt","Bushmills 12 Year Old Single Malt Irish Whiskey"],distillery:"Old Bushmills Distillery",region:"Ireland",type:"Single Malt Irish Whiskey",category:"Irish",proof:80,abv:40,mashbill:null,price:null,quality:null,value:null,notes:"Dark chocolate, dried fruit and spice",desc:"A twelve-year-old Irish single malt with rich cask influence.",image:"assets/bourbons/clean/bushmills-12-year-old-single-malt.webp",source:"manual_official",catalog_status:"verified"},
  {id:"bushmills-16-year-old-single-malt",name:"Bushmills 16 Year Old Single Malt",aliases:["Bushmills 16 Year","Bushmills 16 Year Old","Bushmills 16 Year Single Malt","Bushmills 16 Year Old Single Malt Irish Whiskey"],distillery:"Old Bushmills Distillery",region:"Ireland",type:"Single Malt Irish Whiskey",category:"Irish",proof:80,abv:40,mashbill:null,price:null,quality:null,value:null,notes:"Almond, honey, fruit and port cask richness",desc:"A sixteen-year-old Irish single malt finished in port casks.",image:"",source:"manual_official",catalog_status:"verified"},
  {id:"bushmills-prohibition-recipe",name:"Bushmills Prohibition Recipe",aliases:["Bushmills Prohibition Recipe","Bushmills Prohibition Recipe Irish Whiskey","Bushmills Peaky Blinders Prohibition Recipe"],distillery:"Old Bushmills Distillery",region:"Ireland",type:"Blended Irish Whiskey",category:"Irish",proof:92,abv:46,mashbill:null,price:null,quality:null,value:null,notes:"Rich grain, vanilla, spice and oak",desc:"A higher-proof Bushmills blend inspired by a pre-Prohibition style.",image:"",source:"manual_official",catalog_status:"verified"},
  {id:"jim-beam-single-barrel",name:"Jim Beam Single Barrel",aliases:["Jim Beam Single Barrel","Jim Beam Single Barrel Kentucky Straight Bourbon Whiskey"],distillery:"James B. Beam Distilling Co.",region:"Kentucky",type:"Kentucky Straight Bourbon Whiskey",category:"Single Barrel",proof:null,abv:null,mashbill:null,price:null,quality:null,value:null,notes:"Oak, caramel and vanilla",desc:"A hand-selected single-barrel expression from Jim Beam.",image:"",source:"manual_official",catalog_status:"verified"},
  {id:"jack-daniel-s-bonded-triple-mash",name:"Jack Daniel's Bonded Triple Mash",aliases:["Jack Daniel's Bonded Triple Mash","Jack Daniels Bonded Triple Mash","Jack Daniel's Triple Mash"],distillery:"Jack Daniel Distillery",region:"Tennessee",type:"Blended Straight Whiskey",category:"Bottled-in-Bond",proof:100,abv:50,mashbill:null,price:null,quality:null,value:null,notes:"Honey, malt, oak and soft spice",desc:"A bottled-in-bond blend of three straight whiskeys from Jack Daniel's.",image:"",source:"manual_official",catalog_status:"verified"}
];
function applyScanCatalogOverrides(db){
  const bottles=db&&db.bottles||[];
  const byId={};
  bottles.forEach(function(bottle){ if(bottle&&bottle.id) byId[bottle.id]=bottle; });
  const demoOnly=String(db&&db.version||"").indexOf("demo-200")===0;
  (demoOnly?[]:SCAN_EXTRA_RECORDS).forEach(function(record){
    if(!record || !record.id || byId[record.id]) return;
    const extraNames=[record.name].concat(Array.isArray(record.aliases)?record.aliases:[]).map(norm).filter(Boolean);
    const existing=bottles.find(function(bottle){
      return [bottle&&bottle.name].concat(Array.isArray(bottle&&bottle.aliases)?bottle.aliases:[])
        .map(norm).some(function(name){ return extraNames.indexOf(name)>=0; });
    });
    if(existing){
      existing.aliases=Array.from(new Set((Array.isArray(existing.aliases)?existing.aliases:[]).concat(record.name,record.aliases||[])));
      return;
    }
    const copy=Object.assign({},record,{aliases:(record.aliases||[]).slice()});
    byId[copy.id]=copy;
    bottles.push(copy);
  });
  Object.keys(SCAN_RECORD_OVERRIDES).forEach(function(overrideId){
    const canonicalId=db&&db.id_redirects&&db.id_redirects[overrideId]||overrideId;
    const bottle=byId[canonicalId];
    const override=SCAN_RECORD_OVERRIDES[overrideId];
    if(!bottle || !override) return;
    if(override.aliases) bottle.aliases=Array.from(new Set((Array.isArray(bottle.aliases)?bottle.aliases:[]).concat(override.aliases)));
    if(Number.isFinite(override.proof)) bottle.proof=override.proof;
    if(Number.isFinite(override.abv)) bottle.abv=override.abv;
    ["distillery","type","category"].forEach(function(field){
      if(typeof override[field]==="string" && override[field]) bottle[field]=override[field];
    });
    if(override.scanDisabled && overrideId===canonicalId && bottle.source!=="popular_200_curated") bottle.scan_disabled=true;
  });
  return rebuildScanTokenIndex(db);
}
function rebuildScanTokenIndex(db){
  const index={};
  (db&&db.bottles||[]).forEach(function(bottle,bottleIndex){
    if(!bottle || bottle.scan_disabled) return;
    const values=[bottle.name,bottle.distillery].concat(Array.isArray(bottle.aliases)?bottle.aliases:[]);
    distinctiveTokens(values.join(" ")).forEach(function(token){
      if(!index[token]) index[token]=[];
      if(index[token].indexOf(bottleIndex)<0) index[token].push(bottleIndex);
    });
  });
  db.token_index=index;
  return db;
}
async function getText(url, ttl){ const r = await fetch(url, { cf:{ cacheTtl:ttl, cacheEverything:true } }); return r.ok ? await r.text() : null; }
async function getPrompt(env){
  const now=Date.now(); if(_p.t && now-_p.at<60000) return _p.t;
  try{ const t=await getText(env.PROMPT_URL||DEFAULT_PROMPT_URL,60); if(t&&t.trim()){_p={t:t,at:now};return t;} }catch(e){}
  return _p.t||FALLBACK_PROMPT;
}
async function getStaticDB(env){
  const now=Date.now(); if(_db.d && now-_db.at<300000) return _db.d;
  try{ const t=await getText(env.DB_URL||DEFAULT_DB_URL,300); if(t){ const j=applyScanCatalogOverrides(JSON.parse(t)); _db={d:j,at:now}; return j; } }catch(e){}
  return _db.d||{bottles:[]};
}
async function getDB(env, request){
  const base=await getStaticDB(env);
  // The public scanner is deliberately image-gated. User-created bottles stay private
  // and are never merged into recognition results for other accounts.
  return base;
}

function langName(l){ return l==="en"?"in English":l==="es"?"en espanol":"po polsku"; }
const API_SECURITY_HEADERS={
  "Cache-Control":"no-store",
  "Cross-Origin-Resource-Policy":"cross-origin",
  "Permissions-Policy":"camera=(), microphone=(), geolocation=()",
  "Referrer-Policy":"no-referrer",
  "X-Content-Type-Options":"nosniff"
};
function responseHeaders(extra){ return Object.assign({},API_SECURITY_HEADERS,extra||{}); }
function J(o,s,c){ return new Response(JSON.stringify(o),{status:s,headers:responseHeaders(Object.assign({},c,{"Content-Type":"application/json"}))}); }
function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
function norm(s){ return (s||"").toString().toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim(); }
function toks(s){ return norm(s).split(" ").filter(function(w){ return w.length>=3 || /^[0-9]+$/.test(w); }); }
function parseJson(txt){ if(!txt) return null; let s=txt.replace(/```json/gi,"").replace(/```/g,"").trim(); const a=s.indexOf("{"),b=s.lastIndexOf("}"); if(a<0||b<0||b<a) return null; try{return JSON.parse(s.slice(a,b+1));}catch(e){return null;} }
function clamp01(n){ n=Number(n); if(!Number.isFinite(n)) return 0; if(n>1) n=n/100; return Math.max(0,Math.min(1,n)); }
function encText(s){ return new TextEncoder().encode(String(s||"")); }
function hex(bytes){ return Array.from(new Uint8Array(bytes)).map(function(b){ return b.toString(16).padStart(2,"0"); }).join(""); }
function randHex(bytes){ const a=new Uint8Array(bytes); crypto.getRandomValues(a); return hex(a); }
async function sha256Hex(s){ return hex(await crypto.subtle.digest("SHA-256", encText(s))); }
async function sha256Bytes(value){
  const bytes=value instanceof Uint8Array ? value : new Uint8Array(value);
  return hex(await crypto.subtle.digest("SHA-256",bytes));
}
function b64urlEncode(s){
  const bytes=typeof s==="string" ? encText(s) : new Uint8Array(s);
  let bin="";
  bytes.forEach(function(b){ bin+=String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function b64urlDecode(s){
  s=String(s||"").replace(/-/g,"+").replace(/_/g,"/");
  while(s.length%4) s+="=";
  const bin=atob(s);
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
async function hmacHex(secret, message){
  const key=await crypto.subtle.importKey("raw", encText(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, encText(message)));
}
async function hashPassword(password, saltHex, iterations){
  const salt=new Uint8Array((saltHex.match(/.{1,2}/g)||[]).map(function(x){ return parseInt(x,16); }));
  const key=await crypto.subtle.importKey("raw", encText(password), "PBKDF2", false, ["deriveBits"]);
  const workFactor=Math.max(LEGACY_PBKDF2_ITERATIONS,Math.min(2000000,Number(iterations)||PBKDF2_ITERATIONS));
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:salt,iterations:workFactor,hash:"SHA-256"}, key, 256);
  return hex(bits);
}
function passwordIterations(algo){
  const match=String(algo||"").match(/pbkdf2-sha256-(\d+)/i);
  return match ? Math.max(LEGACY_PBKDF2_ITERATIONS,Number(match[1])||LEGACY_PBKDF2_ITERATIONS) : LEGACY_PBKDF2_ITERATIONS;
}
function publicUser(row){
  return row ? {
    id:row.id,
    email:row.email,
    username:row.username,
    created_at:row.created_at,
    email_verified:!!row.email_verified_at,
    auth_method:row.password_algo==="google-oauth2"?"google":"password"
  } : null;
}
function cleanEmail(v){ return String(v||"").trim().toLowerCase(); }
function cleanUsername(v){ return String(v||"").trim().replace(/\s+/g," ").slice(0,40); }
function cleanProfileBadge(v){ v=String(v||"").trim(); return PROFILE_BADGE_IDS.indexOf(v)>=0 ? v : "glass"; }
function mailConfigured(env){ return !!(env.RESEND_API_KEY && env.MAIL_FROM); }
function appUrl(env){
  const raw=String(env.APP_URL||"https://backloghero-lang.github.io/bourbon-hunters/").trim()||"https://backloghero-lang.github.io/bourbon-hunters/";
  return raw.replace(/\/?$/,"/");
}
function googleReady(env){ return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET); }
function googleRedirectUri(env, request){
  return String(env.GOOGLE_REDIRECT_URI||new URL("/auth/google/callback",request.url).toString()).trim();
}
function allowedReturnUrl(env, raw){
  let fallback=appUrl(env);
  try{
    const candidate=new URL(String(raw||fallback), fallback);
    const allowed=[new URL(appUrl(env)).origin,"https://backloghero-lang.github.io","http://localhost","http://127.0.0.1"];
    if(allowed.indexOf(candidate.origin)>=0) return candidate.toString();
  }catch(e){}
  return fallback;
}
async function makeGoogleState(env, payload){
  const body=b64urlEncode(JSON.stringify(payload||{}));
  const sig=await hmacHex(String(env.GOOGLE_STATE_SECRET||env.GOOGLE_CLIENT_SECRET||""), body);
  return body+"."+sig;
}
async function readGoogleState(env, state){
  const parts=String(state||"").split(".");
  if(parts.length!==2) return null;
  const expected=await hmacHex(String(env.GOOGLE_STATE_SECRET||env.GOOGLE_CLIENT_SECRET||""), parts[0]);
  if(expected!==parts[1]) return null;
  try{
    const data=JSON.parse(b64urlDecode(parts[0]));
    if(!data || Date.now()-Number(data.iat||0)>1000*60*10) return null;
    return data;
  }catch(e){ return null; }
}
function redirectWithHash(returnUrl, params){
  const u=new URL(returnUrl);
  const hash=new URLSearchParams(String(u.hash||"").replace(/^#/,""));
  Object.keys(params||{}).forEach(function(k){
    if(params[k]!=null) hash.set(k,String(params[k]));
  });
  u.hash=hash.toString();
  return Response.redirect(u.toString(),302);
}
function assetUrl(env, path){ return appUrl(env)+String(path||"").replace(/^\/+/,""); }
function supportEmail(env){ return String(env.SUPPORT_EMAIL||"support@bourbonhunters.app").trim(); }
function isAdminUser(env, user){ return !!(user && Number(user.is_admin)===1); }
function constantTimeHexEqual(a,b){
  a=String(a||""); b=String(b||"");
  const length=Math.max(a.length,b.length);
  let diff=a.length^b.length;
  for(let i=0;i<length;i++) diff|=(a.charCodeAt(i%Math.max(1,a.length))||0)^(b.charCodeAt(i%Math.max(1,b.length))||0);
  return diff===0;
}
function htmlEscape(s){
  return String(s||"").replace(/[&<>"']/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
  });
}
async function sendEmail(env, message){
  if(!mailConfigured(env)) return {sent:false,reason:"not_configured"};
  const res=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({
      from:String(env.MAIL_FROM),
      to:message.to,
      subject:message.subject,
      html:message.html,
      text:message.text
    })
  });
  if(!res.ok) return {sent:false,status:res.status,detail:(await res.text()).slice(0,240)};
  return {sent:true};
}
async function sendWelcomeEmail(env, user){
  const name=htmlEscape(user.username||"Hunter");
  const header=htmlEscape(assetUrl(env,"design/figma-assets/home-pack-v2/home-header-v3.jpg"));
  const footer=htmlEscape(assetUrl(env,"assets/brand/email-premium-footer.png"));
  const openUrl=htmlEscape(appUrl(env));
  return sendEmail(env,{
    to:user.email,
    subject:"Welcome to Bourbon Hunters",
    text:"Welcome to Bourbon Hunters, "+(user.username||"Hunter")+". Your account is ready. Open "+appUrl(env),
    html:'<div style="margin:0;background:#080604;padding:24px 12px;font-family:Arial,sans-serif;color:#f6e1bc"><div style="max-width:560px;margin:0 auto;background:#100a06;border:1px solid rgba(226,176,112,.28);border-radius:18px;overflow:hidden"><img src="'+header+'" alt="Bourbon Hunters" style="display:block;width:100%;max-height:142px;object-fit:cover"><div style="padding:24px"><h1 style="margin:0 0 12px;color:#e2b070;font-size:26px;line-height:1.1">Welcome to Bourbon Hunters</h1><p style="margin:0 0 14px;line-height:1.55">Hi '+name+', your hunter profile is ready.</p><p style="margin:0 0 20px;line-height:1.55;color:#d8c4a4">You can now sync your wishlist, collection, ratings and scans across devices.</p><p style="margin:0"><a href="'+openUrl+'" style="display:inline-block;background:#e2b070;color:#1b1008;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700">Open Bourbon Hunters</a></p></div><div style="padding:0 24px 20px;text-align:center"><img src="'+footer+'" alt="" style="width:142px;max-width:44%;height:auto;opacity:.72;border-radius:12px"><p style="margin:12px 0 0;color:#9f8b69;font-size:12px;line-height:1.45">Drink responsibly. 18+.</p></div></div></div>'
  });
}
async function sendEmailVerification(env, user, verifyUrl){
  const name=htmlEscape(user.username||"Hunter");
  const header=htmlEscape(assetUrl(env,"design/figma-assets/home-pack-v2/home-header-v3.jpg"));
  return sendEmail(env,{
    to:user.email,
    subject:"Confirm your Bourbon Hunters email",
    text:"Confirm your Bourbon Hunters email address: "+verifyUrl+" The link expires in 24 hours.",
    html:'<div style="margin:0;background:#080604;padding:24px 12px;font-family:Arial,sans-serif;color:#f6e1bc"><div style="max-width:560px;margin:0 auto;background:#100a06;border:1px solid rgba(226,176,112,.28);border-radius:18px;overflow:hidden"><img src="'+header+'" alt="Bourbon Hunters" style="display:block;width:100%;max-height:142px;object-fit:cover"><div style="padding:24px"><h1 style="margin:0 0 12px;color:#e2b070;font-size:26px;line-height:1.1">Confirm your email</h1><p style="margin:0 0 18px;line-height:1.55">Hi '+name+', confirm this address to activate your Bourbon Hunters account.</p><p style="margin:0 0 18px"><a href="'+htmlEscape(verifyUrl)+'" style="display:inline-block;background:#174d2d;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700">Confirm email</a></p><p style="margin:0;color:#c9b493;font-size:12px;line-height:1.5">The link expires in 24 hours. If this was not you, ignore this email.</p></div></div></div>'
  });
}
async function sendPasswordResetEmail(env, user, resetUrl){
  const header=htmlEscape(assetUrl(env,"design/figma-assets/home-pack-v2/home-header-v3.jpg"));
  const footer=htmlEscape(assetUrl(env,"assets/brand/email-premium-footer.png"));
  return sendEmail(env,{
    to:user.email,
    subject:"Reset your Bourbon Hunters password",
    text:"Use this link to reset your Bourbon Hunters password: "+resetUrl+" The link expires in 60 minutes. If this was not you, ignore this email.",
    html:'<div style="margin:0;background:#080604;padding:24px 12px;font-family:Arial,sans-serif;color:#f6e1bc"><div style="max-width:560px;margin:0 auto;background:#100a06;border:1px solid rgba(226,176,112,.28);border-radius:18px;overflow:hidden"><img src="'+header+'" alt="Bourbon Hunters" style="display:block;width:100%;max-height:142px;object-fit:cover"><div style="padding:24px"><h1 style="margin:0 0 12px;color:#e2b070;font-size:26px;line-height:1.1">Reset your password</h1><p style="margin:0 0 18px;line-height:1.55;color:#d8c4a4">Use the button below to set a new Bourbon Hunters password. This link expires in 60 minutes.</p><p style="margin:0 0 18px"><a href="'+htmlEscape(resetUrl)+'" style="display:inline-block;background:#e2b070;color:#1b1008;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700">Set new password</a></p><p style="margin:0;color:#c9b493;font-size:12px;line-height:1.5">If this was not you, ignore this email or contact '+htmlEscape(supportEmail(env))+'.</p></div><div style="padding:0 24px 20px;text-align:center"><img src="'+footer+'" alt="" style="width:142px;max-width:44%;height:auto;opacity:.72;border-radius:12px"><p style="margin:12px 0 0;color:#9f8b69;font-size:12px;line-height:1.45">Bourbon Hunters premium service notification.</p></div></div></div>'
  });
}
function cleanBirthDate(v){ const s=String(v||"").trim(); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ""; }
function ageGateMin(env){ const n=parseInt(env.AGE_GATE_MIN||"18",10); return Number.isFinite(n) && n>=18 ? n : 18; }
function isOldEnough(birthDate, minAge){
  const m=String(birthDate||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return false;
  const y=parseInt(m[1],10), mo=parseInt(m[2],10)-1, d=parseInt(m[3],10);
  const born=new Date(Date.UTC(y,mo,d));
  if(born.getUTCFullYear()!==y || born.getUTCMonth()!==mo || born.getUTCDate()!==d) return false;
  const now=new Date();
  let age=now.getUTCFullYear()-y;
  const monthDiff=now.getUTCMonth()-mo;
  if(monthDiff<0 || (monthDiff===0 && now.getUTCDate()<d)) age--;
  return age>=minAge;
}
function usernameBase(username,email){
  let base=norm(username||"").replace(/\s+/g,"_").replace(/^_+|_+$/g,"").slice(0,24);
  if(base.length<2) base=norm(String(email||"").split("@")[0]).replace(/\s+/g,"_").slice(0,24);
  if(base.length<2) base="hunter";
  return base;
}
async function readBody(request){ try{ return await request.json(); }catch(e){ return {}; } }
async function readLimitedJson(request, maxBytes){
  const limit=Math.max(1024,Number(maxBytes)||AUTH_BODY_MAX_BYTES);
  const declared=Number(request.headers.get("Content-Length")||0);
  if(declared>limit) return {ok:false,error:"body_too_large",status:413};
  let text="";
  try{ text=await request.text(); }catch(e){ return {ok:false,error:"bad_json",status:400}; }
  if(encText(text).byteLength>limit) return {ok:false,error:"body_too_large",status:413};
  try{
    const body=JSON.parse(text||"{}");
    if(!body || Array.isArray(body) || typeof body!=="object") return {ok:false,error:"bad_json",status:400};
    return {ok:true,body:body};
  }catch(e){ return {ok:false,error:"bad_json",status:400}; }
}
function corsOrigin(value){
  value=String(value||"").trim();
  if(!value || value==="*") return value||"*";
  try{ return new URL(value).origin; }catch(e){ return value.replace(/\/+$/,""); }
}
function apiCors(env, request){
  const raw=String(env.ALLOW_ORIGIN||appUrl(env)).trim();
  let allow="*";
  if(raw && raw!=="*"){
    const requestOrigin=request&&request.headers ? request.headers.get("Origin")||"" : "";
    const allowed=raw.split(",").map(corsOrigin).filter(Boolean);
    allow=allowed.indexOf(requestOrigin)>=0 ? requestOrigin : (allowed[0]||"*");
  }
  const headers={
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
  if(allow!=="*") headers.Vary="Origin";
  return headers;
}
function needDB(env,cors){ if(env.DB) return null; return J({error:"d1_missing",message:"Cloudflare D1 binding DB is not configured."},501,cors); }
async function userColumns(env){
  const rows=await env.DB.prepare("PRAGMA table_info(users)").all();
  const out={};
  (rows.results||[]).forEach(function(r){ if(r.name) out[String(r.name)]=true; });
  return out;
}
async function tableExists(env, name){
  const row=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(String(name||"")).first();
  return !!row;
}
async function tableColumns(env, name){
  if(!/^[a-z0-9_]+$/i.test(String(name||""))) return {};
  const rows=await env.DB.prepare("PRAGMA table_info("+name+")").all();
  const out={};
  (rows.results||[]).forEach(function(row){ if(row.name) out[String(row.name)]=true; });
  return out;
}
async function authSecuritySchemaReady(env){
  if(!env.DB) return false;
  const cols=await userColumns(env);
  return !!(cols.email_verified_at && await tableExists(env,"user_roles") && await tableExists(env,"email_verification_tokens") && await tableExists(env,"auth_link_requests"));
}
async function authRateSchemaReady(env){
  return !!(env.DB && await tableExists(env,"auth_rate_events"));
}
function authRateRule(operation){
  const rules={
    login:{window:15*60,actor:10,ip:50},
    register:{window:60*60,actor:3,ip:10},
    password_reset:{window:60*60,actor:3,ip:10},
    verification_resend:{window:60*60,actor:3,ip:10},
    email_confirm:{window:15*60,actor:10,ip:50},
    password_update:{window:15*60,actor:10,ip:30}
  };
  return rules[operation]||null;
}
async function consumeAuthRate(env, request, operation, actorValue){
  const rule=authRateRule(operation);
  if(!rule) return {allowed:false,error:"auth_rate_operation_invalid"};
  if(!(await authRateSchemaReady(env))) return {allowed:false,error:"auth_rate_schema_missing"};
  const nowMs=Date.now();
  const windowStart=Math.floor(nowMs/(rule.window*1000))*rule.window;
  const windowKey=String(windowStart);
  const ip=String(request.headers.get("CF-Connecting-IP")||"unknown").slice(0,100);
  const actorHash=(await sha256Hex("auth-rate-actor:"+operation+":"+String(actorValue||"unknown").toLowerCase().slice(0,260))).slice(0,40);
  const ipHash=(await sha256Hex("auth-rate-ip:"+ip)).slice(0,40);
  const now=new Date(nowMs).toISOString();
  const insert=await env.DB.prepare("INSERT INTO auth_rate_events (id,window_key,actor_hash,ip_hash,operation,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM auth_rate_events WHERE window_key=? AND operation=? AND actor_hash=?)<? AND (SELECT COUNT(*) FROM auth_rate_events WHERE window_key=? AND operation=? AND ip_hash=?)<?")
    .bind(crypto.randomUUID(),windowKey,actorHash,ipHash,operation,now,windowKey,operation,actorHash,rule.actor,windowKey,operation,ipHash,rule.ip).run();
  const allowed=Number(insert&&insert.meta&&insert.meta.changes||0)>0;
  return {
    allowed:allowed,error:allowed?null:"auth_rate_limited",
    retry_after:allowed?0:Math.max(1,windowStart+rule.window-Math.floor(nowMs/1000))
  };
}
function authRateResponse(rate,cors){
  if(rate&&rate.error==="auth_rate_schema_missing") return J({error:"auth_rate_schema_missing"},503,cors);
  return J({error:"too_many_requests",retry_after:Number(rate&&rate.retry_after)||60},429,Object.assign({},cors,{"Retry-After":String(Number(rate&&rate.retry_after)||60)}));
}
async function userHasRole(env, userId, role){
  if(!userId || !(await tableExists(env,"user_roles"))) return false;
  const row=await env.DB.prepare("SELECT 1 AS allowed FROM user_roles WHERE user_id=? AND role=? AND revoked_at IS NULL LIMIT 1")
    .bind(String(userId),String(role)).first();
  return !!row;
}
async function attachRoleFlags(env, row){
  if(!row) return row;
  row.is_admin=(await userHasRole(env,row.id,"admin"))?1:0;
  return row;
}
async function catalogDataSchemaReady(env){
  if(!(await tableExists(env,"catalog_asset_receipts"))) return false;
  const submissions=await tableColumns(env,"bottle_submissions");
  const catalog=await tableColumns(env,"catalog_bottles");
  return !!(submissions.consent_version && submissions.original_deleted_at && submissions.published_key && submissions.asset_sha256 && catalog.image_key && catalog.license_version && catalog.provenance_submission_id);
}
async function catalogModerationSchemaReady(env){
  return !!(env.DB && await tableExists(env,"catalog_moderation_queue"));
}
async function telemetrySchemaReady(env){
  return !!(env.DB && await tableExists(env,"telemetry_events") && await tableExists(env,"scanner_runs") && await tableExists(env,"service_usage_events"));
}
async function scannerBudgetSchemaReady(env){
  return !!(env.DB && await tableExists(env,"scanner_budget_events"));
}
function scannerBudgetLimits(env, operation){
  let actorLimit=5, ipLimit=100;
  if(operation==="cutout"){
    actorLimit=Number(env.LOCAL_CUTOUT_DAILY_LIMIT)||10;
    ipLimit=Number(env.LOCAL_CUTOUT_IP_DAILY_LIMIT)||Math.max(40,actorLimit*4);
  }else if(operation==="analysis"){
    actorLimit=Number(env.ANALYZE_DAILY_LIMIT)||3;
    ipLimit=Number(env.ANALYZE_IP_DAILY_LIMIT)||Math.max(30,actorLimit*10);
  }else{
    actorLimit=Number(env.DAILY_LIMIT)||5;
    ipLimit=Number(env.SCAN_IP_DAILY_LIMIT)||Math.max(100,actorLimit*10);
  }
  actorLimit=Math.max(1,Math.min(500,Math.floor(actorLimit)));
  ipLimit=Math.max(actorLimit,Math.min(5000,Math.floor(ipLimit)));
  return {actor:actorLimit,ip:ipLimit};
}
async function consumeScannerBudget(env, request, user, deviceHash, operation){
  if(isAdminUser(env,user)) return {allowed:true,owner:true,remaining:null,limit:null,operation:operation};
  if(["identify","cutout","analysis"].indexOf(operation)<0) return {allowed:false,error:"budget_operation_invalid",operation:operation};
  if(!(await scannerBudgetSchemaReady(env))) return {allowed:false,error:"scanner_budget_schema_missing",operation:operation};
  const ip=String(request.headers.get("CF-Connecting-IP")||"unknown").slice(0,80);
  const actorType=user&&user.id?"user":"guest";
  const actorSeed=user&&user.id ? "user:"+user.id : (deviceHash ? "device:"+deviceHash : "ip:"+ip);
  const actorHash=(await sha256Hex("scanner-budget-actor:"+actorSeed)).slice(0,40);
  const ipHash=(await sha256Hex("scanner-budget-ip:"+ip)).slice(0,40);
  const periodKey=new Date().toISOString().slice(0,10);
  const now=new Date().toISOString();
  const limits=scannerBudgetLimits(env,operation);
  const insert=await env.DB.prepare("INSERT INTO scanner_budget_events (id,period_key,actor_type,actor_hash,ip_hash,operation,units,created_at) SELECT ?,?,?,?,?,?,1,? WHERE (SELECT COALESCE(SUM(units),0) FROM scanner_budget_events WHERE period_key=? AND operation=? AND actor_hash=?)<? AND (SELECT COALESCE(SUM(units),0) FROM scanner_budget_events WHERE period_key=? AND operation=? AND ip_hash=?)<?")
    .bind(crypto.randomUUID(),periodKey,actorType,actorHash,ipHash,operation,now,periodKey,operation,actorHash,limits.actor,periodKey,operation,ipHash,limits.ip).run();
  const usage=await env.DB.prepare("SELECT COALESCE(SUM(CASE WHEN actor_hash=? THEN units ELSE 0 END),0) AS actor_used,COALESCE(SUM(CASE WHEN ip_hash=? THEN units ELSE 0 END),0) AS ip_used FROM scanner_budget_events WHERE period_key=? AND operation=? AND (actor_hash=? OR ip_hash=?)")
    .bind(actorHash,ipHash,periodKey,operation,actorHash,ipHash).first();
  const actorUsed=Number(usage&&usage.actor_used)||0;
  const ipUsed=Number(usage&&usage.ip_used)||0;
  const allowed=Number(insert&&insert.meta&&insert.meta.changes||0)>0;
  return {
    allowed:allowed,owner:false,operation:operation,limit:limits.actor,
    remaining:Math.max(0,limits.actor-actorUsed),
    reason:allowed?null:(actorUsed>=limits.actor?"actor_limit":"ip_limit"),
    ip_remaining:Math.max(0,limits.ip-ipUsed)
  };
}
async function cleanupScannerBudgets(env){
  if(!(await scannerBudgetSchemaReady(env))) return {deleted:0};
  const cutoff=new Date(Date.now()-8*86400000).toISOString();
  const result=await env.DB.prepare("DELETE FROM scanner_budget_events WHERE created_at<?").bind(cutoff).run();
  return {deleted:Number(result&&result.meta&&result.meta.changes||0)};
}
async function cleanupAuthRates(env){
  if(!(await authRateSchemaReady(env))) return {deleted:0};
  const cutoff=new Date(Date.now()-2*86400000).toISOString();
  const result=await env.DB.prepare("DELETE FROM auth_rate_events WHERE created_at<?").bind(cutoff).run();
  return {deleted:Number(result&&result.meta&&result.meta.changes||0)};
}
async function newsSchemaReady(env){
  return !!(env.DB && await tableExists(env,"news_articles") && await tableExists(env,"news_agent_runs"));
}
function operationalTelemetryEnabled(env){ return String(env.OPERATIONAL_TELEMETRY_ENABLED||"1")!=="0"; }
function telemetryRetentionDays(env){ return Math.max(7,Math.min(365,Number(env.TELEMETRY_RETENTION_DAYS)||90)); }
async function telemetryDeviceHash(deviceId){
  const value=String(deviceId||"").trim().slice(0,180);
  return value ? (await sha256Hex("telemetry-device:"+value)).slice(0,32) : null;
}
function geminiUsage(data, meta){
  const usage=(data&&data.usageMetadata)||{};
  return {
    id:crypto.randomUUID(),provider:"google",stage:String(meta&&meta.stage||"unknown"),model:String(meta&&meta.model||"unknown"),
    status:Number(meta&&meta.status)||0,attempts:Number(meta&&meta.attempts)||0,
    prompt_tokens:Number(usage.promptTokenCount)||0,output_tokens:Number(usage.candidatesTokenCount)||0,
    total_tokens:Number(usage.totalTokenCount)||0,cached_tokens:Number(usage.cachedContentTokenCount)||0,
    thought_tokens:Number(usage.thoughtsTokenCount)||0,duration_ms:Number(meta&&meta.duration_ms)||0
  };
}
async function recordServiceUsage(env, scanId, userId, usage){
  if(!usage || !operationalTelemetryEnabled(env) || !(await telemetrySchemaReady(env))) return;
  const now=new Date().toISOString();
  await env.DB.prepare("INSERT INTO service_usage_events (id,scan_id,user_id,provider,stage,model,status,attempts,prompt_tokens,output_tokens,total_tokens,cached_tokens,thought_tokens,duration_ms,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(usage.id||crypto.randomUUID(),scanId||null,userId||null,usage.provider||"unknown",usage.stage||"unknown",usage.model||"unknown",Number(usage.status)||0,Number(usage.attempts)||0,Number(usage.prompt_tokens)||0,Number(usage.output_tokens)||0,Number(usage.total_tokens)||0,Number(usage.cached_tokens)||0,Number(usage.thought_tokens)||0,Number(usage.duration_ms)||0,now).run();
}
async function recordScannerRun(env, data){
  if(!operationalTelemetryEnabled(env) || !(await telemetrySchemaReady(env))) return;
  const now=new Date().toISOString();
  await env.DB.prepare("INSERT OR REPLACE INTO scanner_runs (id,user_id,device_hash,actor_type,mode,outcome,error_code,matched_bottle_id,suggested_bottle_id,confirmed_bottle_id,candidate_ids_json,candidate_count,confidence,visual_confidence,ocr_confidence,db_confidence,min_confidence,input_bytes,duration_ms,started_at,completed_at,confirmed_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(data.id,data.user_id||null,data.device_hash||null,data.actor_type||"guest",data.mode||"rate",data.outcome||"error",data.error_code||null,data.matched_bottle_id||null,data.suggested_bottle_id||null,data.confirmed_bottle_id||null,JSON.stringify(data.candidates||[]).slice(0,4000),Number(data.candidate_count)||0,Number(data.confidence)||0,Number(data.visual_confidence)||0,Number(data.ocr_confidence)||0,Number(data.db_confidence)||0,Number(data.min_confidence)||0,Number(data.input_bytes)||0,Number(data.duration_ms)||0,data.started_at||now,data.completed_at||now,data.confirmed_at||null,data.created_at||now).run();
  for(const usage of (data.usage||[])) await recordServiceUsage(env,data.id,data.user_id,usage);
}
async function cleanupTelemetry(env){
  if(!(await telemetrySchemaReady(env))) return {deleted:0};
  const cutoff=new Date(Date.now()-telemetryRetentionDays(env)*86400000).toISOString();
  const a=await env.DB.prepare("DELETE FROM service_usage_events WHERE created_at<?").bind(cutoff).run();
  const b=await env.DB.prepare("DELETE FROM telemetry_events WHERE created_at<?").bind(cutoff).run();
  const c=await env.DB.prepare("DELETE FROM scanner_runs WHERE created_at<?").bind(cutoff).run();
  return {deleted:Number(a.meta&&a.meta.changes||0)+Number(b.meta&&b.meta.changes||0)+Number(c.meta&&c.meta.changes||0)};
}
function safeJson(value, fallback){
  try{ return JSON.parse(String(value||"")); }catch(e){ return fallback; }
}
function decodeBase64(value){
  const clean=String(value||"").replace(/^data:[^,]+,/,"").replace(/\s+/g,"");
  const binary=atob(clean);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return bytes;
}
function encodeBase64(value){
  const bytes=value instanceof Uint8Array ? value : new Uint8Array(value);
  let out="";
  for(let i=0;i<bytes.length;i+=0x8000){
    out+=String.fromCharCode.apply(null,bytes.subarray(i,Math.min(i+0x8000,bytes.length)));
  }
  return btoa(out);
}
function cleanCatalogId(value){
  return String(value||"").toLowerCase().trim().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,180);
}
function catalogPriceAllowed(data){
  const raw=[data&&data.price_value,data&&data.price,data&&data.price_str,data&&data.price_pln].filter(function(v){ return v!=null && v!==""; }).join(" ");
  const nums=String(raw).replace(/,/g,".").match(/\d+(?:\.\d+)?/g)||[];
  if(!nums.length) return true;
  const max=Math.max.apply(null,nums.map(Number).filter(Number.isFinite));
  if(!Number.isFinite(max)) return true;
  const currency=String((data&&data.price_currency)||"").toUpperCase();
  if(currency==="USD" || /\$|USD/i.test(raw)) return max<=350;
  if(currency==="PLN" || /PLN|ZL|ZŁ/i.test(raw)) return max<=1000;
  return true;
}
function cleanCatalogBottle(value){
  const src=value&&typeof value==="object" ? value : {};
  const id=cleanCatalogId(src.id||src.handle||src.name);
  const out={
    id:id,
    name:String(src.name||"").trim().slice(0,180),
    type:String(src.type||"").trim().slice(0,100),
    category:String(src.category||"").trim().slice(0,100),
    distillery:String(src.distillery||"").trim().slice(0,140),
    region:String(src.region||"").trim().slice(0,100),
    mashbill:String(src.mashbill||"").trim().slice(0,240),
    abv:src.abv==null?null:Number(src.abv),
    proof:src.proof==null?null:Number(src.proof),
    price:String(src.price||src.price_str||src.price_pln||"").trim().slice(0,80),
    price_value:src.price_value==null?null:Number(src.price_value),
    price_currency:String(src.price_currency||"").trim().toUpperCase().slice(0,8),
    quality:Math.max(0,Math.min(5,Number(src.quality)||0)),
    value:Math.max(0,Math.min(5,Number(src.value)||0)),
    notes:String(src.notes||"").trim().slice(0,700),
    desc:String(src.desc||src.verdict||"").trim().slice(0,1600),
    source:"community_catalog",
    isNew:true
  };
  if(!Number.isFinite(out.abv)) out.abv=null;
  if(!Number.isFinite(out.proof)) out.proof=null;
  if(!Number.isFinite(out.price_value)) out.price_value=null;
  return out;
}
function catalogBottleVisible(bottle){
  const b=bottle&&typeof bottle==="object"?bottle:{};
  const text=norm([b.name,(b.aliases||[]).join(" "),b.type,b.category,b.region].join(" "));
  const barrelDerived=/\b(?:finished?|finishing|casks?|barrel (?:finish|finished|aged)|secondary barrel|staves?|wood finish|oak finish)\b/.test(text);
  const flavored=!barrelDerived && (/\b(?:flavou?red|infused|infusion|liqueur|whisk(?:e)?y cream|natural flavou?r)\b/.test(text) ||
    /\b(?:apple|cider|honey|peach|pineapple|orange|mandarin|blackberry|black cherry|cherry|blueberry|strawberry|watermelon|banana|huckleberry|mango|lemon|lime|coconut|peanut butter|salted caramel|brown sugar|maple|vanilla|chocolate|mocha|coffee|s ?mores|cinnamon|eggnog|pumpkin spice|praline|pecan|cookie|marshmallow)\b/.test(text) ||
    /\b(?:fireball|sinfire|skrewball|southern comfort|howler head|ballotin|bird dog|sheep dog|red stag)\b/.test(text));
  if(flavored) return false;
  if(/\b(?:australia|austria|belgium|denmark|england|finland|france|germany|iceland|india|israel|italy|mexico|netherlands|new zealand|norway|south africa|spain|sweden|switzerland|taiwan|wales)\b/.test(text)) return false;
  return true;
}
function publicCatalogBottle(row, request){
  const data=safeJson(row&&row.bottle_data,{});
  data.id=row.bottle_id;
  data.name=data.name||row.bottle_name;
  data.source="community_catalog";
  data.isNew=true;
  data.added_at=row.created_at;
  data.image=(row.image_key || row.image_submission_id) ? new URL("/catalog/image/"+encodeURIComponent(row.bottle_id)+"?v="+encodeURIComponent(row.updated_at||row.created_at||"1"),request.url).toString() : "";
  data.has_image=!!(row.image_key || row.image_submission_id);
  return data;
}
async function enrichScanCandidatesWithCatalogAssets(env, request, candidates){
  if(!env.DB || !(await tableExists(env,"catalog_bottles"))) return candidates;
  for(const candidate of (candidates||[])){
    if(!candidate || !candidate.id || (candidate.result&&candidate.result.image)) continue;
    const row=await env.DB.prepare("SELECT * FROM catalog_bottles WHERE bottle_id=? AND status='published' LIMIT 1").bind(candidate.id).first();
    if(!row) continue;
    const community=publicCatalogBottle(row,request);
    candidate.result=Object.assign({},candidate.result||{}, {
      id:candidate.id,
      name:(candidate.result&&candidate.result.name)||candidate.name||community.name||"",
      image:community.image||"",
      has_image:!!community.image,
      source:community.image?"community_catalog":((candidate.result&&candidate.result.source)||"baza")
    });
    candidate.name=candidate.result.name;
  }
  return candidates;
}
async function deleteSubmissionImages(env, row){
  if(!env.BOTTLE_IMAGES || !row) return;
  const keys=[row.original_key,row.processed_key].filter(Boolean);
  if(keys.length) await deleteR2Keys(env,keys);
}
async function deleteR2Keys(env, keys){
  if(!env.BOTTLE_IMAGES) return;
  const unique=Array.from(new Set((keys||[]).filter(Boolean)));
  for(let i=0;i<unique.length;i+=1000) await env.BOTTLE_IMAGES.delete(unique.slice(i,i+1000));
}
async function cleanupStaleCatalogSubmissions(env, limit){
  if(!env.DB || !env.BOTTLE_IMAGES || !(await tableExists(env,"bottle_submissions"))) return {cleaned:0};
  const cutoff=new Date(Date.now()-24*60*60*1000).toISOString();
  const moderationFilter=await catalogModerationSchemaReady(env) ? " AND id NOT IN (SELECT submission_id FROM catalog_moderation_queue WHERE admin_status='pending')" : "";
  const rows=await env.DB.prepare("SELECT id,original_key,processed_key FROM bottle_submissions WHERE status IN ('processing','awaiting_confirmation') AND updated_at<?"+moderationFilter+" ORDER BY updated_at LIMIT ?")
    .bind(cutoff,Math.max(1,Math.min(200,Number(limit)||50))).all();
  let cleaned=0;
  for(const row of (rows.results||[])){
    await deleteSubmissionImages(env,row);
    const now=new Date().toISOString();
    await env.DB.prepare("UPDATE bottle_submissions SET status='cancelled',image_choice='expired',original_key=NULL,processed_key=NULL,original_deleted_at=COALESCE(original_deleted_at,?),updated_at=? WHERE id=?")
      .bind(now,now,row.id).run();
    cleaned++;
  }
  return {cleaned:cleaned};
}
async function transformBottleCutout(env, mime, image){
  if(!env.IMAGES) return null;
  const bytes=decodeBase64(String(image||""));
  if(!bytes.byteLength || bytes.byteLength>6000000) throw new Error("image_too_large");
  const output=await env.IMAGES.input(new Blob([bytes],{type:mime}).stream())
    .transform({segment:"foreground"})
    .transform({trim:"border"})
    .transform({width:960,height:1280,fit:"pad",background:"rgba(0,0,0,0)",sharpen:1})
    .output({format:"image/webp",quality:92});
  const response=output.response();
  if(!response.ok) throw new Error("image_transform_"+response.status);
  return new Uint8Array(await response.arrayBuffer());
}
async function transformRecognitionForeground(env, mime, image){
  if(!env.IMAGES) return null;
  const bytes=decodeBase64(String(image||""));
  if(!bytes.byteLength || bytes.byteLength>6000000) return null;
  const output=await env.IMAGES.input(new Blob([bytes],{type:mime}).stream())
    .transform({segment:"foreground"})
    .transform({trim:"border"})
    .transform({width:960,height:1100,fit:"pad",background:"rgba(0,0,0,0)",sharpen:1})
    .output({format:"image/webp",quality:84});
  const response=output.response();
  if(!response.ok) throw new Error("recognition_foreground_"+response.status);
  return new Uint8Array(await response.arrayBuffer());
}
async function assessBottleCutout(env, bottleName, processed){
  if(!env.GEMINI_API_KEY || !processed || !processed.byteLength){
    return {checked:false,acceptable:true,reason_code:"qa_unavailable",confidence:0,usage:null};
  }
  const payload={
    __model:env.CUTOUT_QA_MODEL||env.IDENT_MODEL||"gemini-3.5-flash-lite",
    contents:[{role:"user",parts:[
      {text:"Ocen wyciety asset butelki do katalogu aplikacji. Nazwa produktu dla kontekstu: "+String(bottleName||"nieznana").slice(0,180)+". Zaakceptuj tylko jedna kompletna butelke widoczna od korka do dna, bez dloni, palcow, polki, cenowki ani innych obiektow. Odrzuc asset, jezeli szyjka, korek, etykieta lub dno sa uciete, przezroczyste, maja dziury albo zostaly uszkodzone przez usuwanie tla. Nie oceniaj poprawnosci marki i nie poprawiaj etykiety. centered oznacza, ze butelka jest pionowa i wizualnie wycentrowana. Zwroc reason_code: ok, hand_or_object, bottle_cut_off, segmentation_damage, multiple_objects albo poor_framing."},
      {inlineData:{mimeType:"image/webp",data:encodeBase64(processed)}}
    ]}],
    generationConfig:{
      maxOutputTokens:220,
      responseMimeType:"application/json",
      responseSchema:{
        type:"OBJECT",
        properties:{
          acceptable:{type:"BOOLEAN"},
          complete_bottle:{type:"BOOLEAN"},
          occlusion_present:{type:"BOOLEAN"},
          segmentation_damage:{type:"BOOLEAN"},
          centered:{type:"BOOLEAN"},
          reason_code:{type:"STRING"},
          confidence:{type:"NUMBER",minimum:0,maximum:1}
        },
        required:["acceptable","complete_bottle","occlusion_present","segmentation_damage","centered","reason_code","confidence"]
      }
    }
  };
  const response=await callGemini(env,payload,"bottle_cutout_qa");
  if(response.err) return {checked:false,acceptable:true,reason_code:"qa_unavailable",confidence:0,usage:response.usage};
  const data=parseJson(response.txt)||{};
  const confidence=clamp01(data.confidence);
  const decisive=confidence>=0.68;
  const acceptable=!decisive || !!(data.acceptable && data.complete_bottle && !data.occlusion_present && !data.segmentation_damage);
  return {
    checked:decisive,
    acceptable:acceptable,
    reason_code:acceptable?"ok":String(data.reason_code||"poor_framing").slice(0,80),
    confidence:confidence,
    complete_bottle:!!data.complete_bottle,
    centered:!!data.centered,
    usage:response.usage
  };
}
async function createBottlePreview(env, request, user, body){
  if(!(await catalogDataSchemaReady(env))) return {error:"schema_catalog_lifecycle_missing",status:501};
  await cleanupStaleCatalogSubmissions(env,20);
  const bottle=cleanCatalogBottle(body&&body.bottle_data);
  bottle.id=cleanCatalogId((body&&body.bottle_id)||bottle.id);
  if(!bottle.id || !bottle.name) return {error:"bad_bottle",status:400};
  if(!catalogBottleVisible(bottle)) return {error:"catalog_product_hidden",status:400};
  if(!catalogPriceAllowed(bottle)) return {error:"price_limit",status:400};
  const today=new Date(); today.setUTCHours(0,0,0,0);
  const count=await env.DB.prepare("SELECT COUNT(*) AS count FROM bottle_submissions WHERE user_id=? AND created_at>=?").bind(user.id,today.toISOString()).first();
  if(Number(count&&count.count)>=10) return {error:"submission_limit",status:429};
  const image=String((body&&body.image)||"");
  const mime=["image/jpeg","image/png","image/webp"].includes(body&&body.mime)?body.mime:"image/jpeg";
  if(!image || image.length<100 || image.length>8000000) return {error:"bad_image",status:400};
  if(env.BOTTLE_IMAGES && env.IMAGES){
    const deviceHash=await telemetryDeviceHash(body&&body.device_id);
    const budget=await consumeScannerBudget(env,request,user,deviceHash,"cutout");
    if(!budget.allowed) return {error:budget.error||"catalog_cutout_limit",limit:budget.limit||0,remaining:budget.remaining||0,reason:budget.reason||null,status:budget.error?503:429};
  }
  const id=crypto.randomUUID();
  const now=new Date().toISOString();
  const originalKey="catalog/tmp/"+id+"/source";
  const processedKey="catalog/tmp/"+id+"/preview.webp";
  const imageStarted=Date.now();
  await env.DB.prepare("INSERT INTO bottle_submissions (id,user_id,bottle_id,bottle_name,bottle_data,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id,user.id,bottle.id,bottle.name,JSON.stringify(bottle),"processing",now,now).run();
  if(!env.BOTTLE_IMAGES || !env.IMAGES){
    await env.DB.prepare("UPDATE bottle_submissions SET status='awaiting_confirmation',updated_at=? WHERE id=?").bind(now,id).run();
    return {submission_id:id,preview_ready:false,image_pipeline_ready:false};
  }
  try{
    const bytes=decodeBase64(image);
    if(bytes.byteLength>6000000) throw new Error("image_too_large");
    await env.BOTTLE_IMAGES.put(originalKey,bytes,{httpMetadata:{contentType:mime}});
    const processed=await transformBottleCutout(env,mime,image);
    if(!processed) throw new Error("image_pipeline_unavailable");
    const quality=await assessBottleCutout(env,bottle.name,processed);
    if(quality.usage) await recordServiceUsage(env,null,user.id,quality.usage).catch(function(){});
    if(!quality.acceptable) throw new Error("cutout_quality_"+quality.reason_code);
    const assetSha=await sha256Bytes(processed);
    await env.BOTTLE_IMAGES.put(processedKey,processed,{httpMetadata:{contentType:"image/webp",cacheControl:"public, max-age=31536000, immutable"}});
    await env.BOTTLE_IMAGES.delete(originalKey);
    const processedAt=new Date().toISOString();
    await env.DB.prepare("UPDATE bottle_submissions SET original_key=NULL,processed_key=?,asset_sha256=?,original_deleted_at=?,status='awaiting_confirmation',updated_at=? WHERE id=?")
      .bind(processedKey,assetSha,processedAt,processedAt,id).run();
    await recordServiceUsage(env,null,user.id,{provider:"cloudflare",stage:"image_cutout",model:"cloudflare-images",status:200,attempts:1,duration_ms:Date.now()-imageStarted}).catch(function(){});
    return {submission_id:id,preview_ready:true,image_pipeline_ready:true,preview_data_url:"data:image/webp;base64,"+encodeBase64(processed)};
  }catch(e){
    if(env.BOTTLE_IMAGES) await env.BOTTLE_IMAGES.delete([originalKey,processedKey]).catch(function(){});
    const failedAt=new Date().toISOString();
    await env.DB.prepare("UPDATE bottle_submissions SET original_key=NULL,processed_key=NULL,original_deleted_at=?,status='awaiting_confirmation',updated_at=? WHERE id=?").bind(failedAt,failedAt,id).run();
    await recordServiceUsage(env,null,user.id,{provider:"cloudflare",stage:"image_cutout",model:"cloudflare-images",status:500,attempts:1,duration_ms:Date.now()-imageStarted}).catch(function(){});
    return {submission_id:id,preview_ready:false,image_pipeline_ready:true,preview_error:String(e&&e.message?e.message:e).slice(0,120)};
  }
}
async function stageCatalogReviewAsset(env, row){
  if(!row || !row.processed_key || !env.BOTTLE_IMAGES) return {image_key:null,asset_sha256:null};
  const object=await env.BOTTLE_IMAGES.get(row.processed_key);
  if(!object) throw new Error("preview_missing");
  const bytes=new Uint8Array(await object.arrayBuffer());
  const assetSha=row.asset_sha256 || await sha256Bytes(bytes);
  const imageKey="catalog/review/"+row.id+"/"+assetSha+".webp";
  await env.BOTTLE_IMAGES.put(imageKey,bytes,{httpMetadata:{contentType:"image/webp",cacheControl:"private, no-store"}});
  return {image_key:imageKey,asset_sha256:assetSha};
}
async function publishModeratedAsset(env, row){
  if(!row || !row.review_image_key || !env.BOTTLE_IMAGES) return {image_key:null,asset_sha256:null};
  const object=await env.BOTTLE_IMAGES.get(row.review_image_key);
  if(!object) throw new Error("review_image_missing");
  const bytes=new Uint8Array(await object.arrayBuffer());
  const assetSha=row.asset_sha256 || await sha256Bytes(bytes);
  const imageKey="catalog/published/"+cleanCatalogId(row.bottle_id)+"/"+assetSha+".webp";
  await env.BOTTLE_IMAGES.put(imageKey,bytes,{httpMetadata:{contentType:"image/webp",cacheControl:"public, max-age=31536000, immutable"}});
  return {image_key:imageKey,asset_sha256:assetSha};
}
async function recordCatalogReceipt(env, user, row, published, acceptedAt){
  const contributorHash=await sha256Hex("catalog-contributor:"+user.id);
  const originalDeletedAt=row.original_deleted_at || acceptedAt;
  await env.DB.prepare("INSERT INTO catalog_asset_receipts (id,submission_id,bottle_id,contributor_hash,license_version,accepted_at,asset_sha256,image_key,original_deleted_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(submission_id) DO UPDATE SET license_version=excluded.license_version,accepted_at=excluded.accepted_at,asset_sha256=excluded.asset_sha256,image_key=excluded.image_key,original_deleted_at=excluded.original_deleted_at,updated_at=excluded.updated_at")
    .bind(crypto.randomUUID(),row.id,row.bottle_id,contributorHash,CATALOG_LICENSE_VERSION,acceptedAt,published.asset_sha256,published.image_key,originalDeletedAt,acceptedAt,acceptedAt).run();
}
async function catalogModerationAssessment(env, row){
  const bottle=safeJson(row&&row.bottle_data,{});
  const staticDb=await getStaticDB(env);
  const exact=(staticDb.bottles||[]).find(function(candidate){ return candidate&&candidate.id===row.bottle_id&&!candidate.scan_disabled; })||null;
  if(exact){
    return {status:"passed",confidence:0.99,reason:"known_catalog_id",matched_id:exact.id,matched_name:exact.name};
  }
  const name=String(row&&row.bottle_name||bottle.name||"").trim();
  const matched=name ? matchBottleWithVisual(staticDb,{name:name,confidence:0.95,candidates:[]}) : null;
  const same=!!(matched&&matched.bottle&&cleanCatalogId(matched.bottle.name)===cleanCatalogId(name));
  return {
    status:same&&matched.dbConfidence>=0.8?"passed":"needs_review",
    confidence:matched?clamp01(matched.dbConfidence):0,
    reason:matched?(same?"name_confirmed":"similar_catalog_record"):"new_catalog_record",
    matched_id:matched&&matched.bottle&&matched.bottle.id||null,
    matched_name:matched&&matched.bottle&&matched.bottle.name||null,
    candidates:matched&&matched.candidates?matched.candidates.slice(0,3).map(function(candidate){ return {id:candidate.id,name:candidate.name,confidence:candidate.confidence}; }):[]
  };
}
async function confirmBottleSubmission(env, request, user, body){
  if(!(await catalogDataSchemaReady(env))) return {error:"schema_catalog_lifecycle_missing",status:501};
  if(!(await catalogModerationSchemaReady(env))) return {error:"schema_catalog_moderation_missing",status:501};
  const id=String((body&&body.submission_id)||"").trim();
  const decision=String((body&&body.decision)||"").trim();
  const row=await env.DB.prepare("SELECT * FROM bottle_submissions WHERE id=? AND user_id=?").bind(id,user.id).first();
  if(!row) return {error:"submission_not_found",status:404};
  if(["cancel","retry"].indexOf(decision)>=0){
    await deleteSubmissionImages(env,row);
    await env.DB.prepare("UPDATE bottle_submissions SET status=?,image_choice=?,original_key=NULL,processed_key=NULL,updated_at=? WHERE id=?")
      .bind(decision==="retry"?"retry":"cancelled",decision,new Date().toISOString(),id).run();
    return {ok:true,status:decision};
  }
  if(["accept","without_image"].indexOf(decision)<0) return {error:"bad_decision",status:400};
  if(decision==="accept" && !row.processed_key) return {error:"preview_missing",status:409};
  const now=new Date().toISOString();
  const oldCatalog=await env.DB.prepare("SELECT bottle_id FROM catalog_bottles WHERE bottle_id=? AND status='published'").bind(row.bottle_id).first();
  if(oldCatalog) return {error:"catalog_entry_locked",status:409,message:"This published catalog entry cannot be replaced by a user submission."};
  const pending=await env.DB.prepare("SELECT id FROM catalog_moderation_queue WHERE bottle_id=? AND admin_status='pending'").bind(row.bottle_id).first();
  if(pending) return {error:"catalog_review_pending",status:409};
  const reviewAsset=decision==="accept" ? await stageCatalogReviewAsset(env,row) : {image_key:null,asset_sha256:null};
  if(decision==="without_image") await deleteSubmissionImages(env,row);
  await deleteSubmissionImages(env,row);
  const assessment=await catalogModerationAssessment(env,row);
  const moderationId=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO catalog_moderation_queue (id,submission_id,bottle_id,bottle_name,bottle_data,review_image_key,asset_sha256,orchestrator_status,orchestrator_confidence,orchestrator_json,admin_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,'pending',?,?)")
    .bind(moderationId,row.id,row.bottle_id,row.bottle_name,row.bottle_data,reviewAsset.image_key,reviewAsset.asset_sha256,assessment.status,assessment.confidence,JSON.stringify(assessment),now,now).run();
  await env.DB.prepare("UPDATE bottle_submissions SET image_choice=?,consent_version=?,consented_at=?,original_key=NULL,processed_key=NULL,published_key=NULL,asset_sha256=?,original_deleted_at=COALESCE(original_deleted_at,?),updated_at=? WHERE id=?")
    .bind(decision,CATALOG_LICENSE_VERSION,now,reviewAsset.asset_sha256,now,now,id).run();
  return {ok:true,status:"pending_review",moderation_id:moderationId,orchestrator:{status:assessment.status,confidence:assessment.confidence},license_version:CATALOG_LICENSE_VERSION,source_deleted:true};
}

async function adminCatalogModerationList(env, request){
  const rows=await env.DB.prepare("SELECT mq.*,bs.user_id FROM catalog_moderation_queue mq JOIN bottle_submissions bs ON bs.id=mq.submission_id WHERE mq.admin_status='pending' ORDER BY mq.created_at ASC LIMIT 50").all();
  return {moderation_version:CATALOG_MODERATION_VERSION,items:(rows.results||[]).map(function(row){
    return {
      id:row.id,submission_id:row.submission_id,bottle_id:row.bottle_id,bottle_name:row.bottle_name,
      bottle_data:safeJson(row.bottle_data,{}),has_image:!!row.review_image_key,
      image_url:row.review_image_key?new URL("/admin/catalog/moderation/"+encodeURIComponent(row.id)+"/image",request.url).toString():"",
      orchestrator_status:row.orchestrator_status,orchestrator_confidence:Number(row.orchestrator_confidence)||0,
      orchestrator:safeJson(row.orchestrator_json,{}),created_at:row.created_at
    };
  })};
}

async function adminCatalogModerationDecision(env, request, admin, moderationId, body){
  const decision=String(body&&body.decision||"").trim();
  if(["approve","reject"].indexOf(decision)<0) return {error:"bad_decision",status:400};
  const row=await env.DB.prepare("SELECT mq.*,bs.user_id,bs.original_deleted_at FROM catalog_moderation_queue mq JOIN bottle_submissions bs ON bs.id=mq.submission_id WHERE mq.id=?").bind(moderationId).first();
  if(!row) return {error:"moderation_not_found",status:404};
  if(row.admin_status!=="pending") return {error:"moderation_already_decided",status:409};
  const now=new Date().toISOString();
  const note=String(body&&body.note||"").trim().slice(0,500);
  if(decision==="reject"){
    if(row.review_image_key&&env.BOTTLE_IMAGES) await env.BOTTLE_IMAGES.delete(row.review_image_key).catch(function(){});
    await env.DB.prepare("UPDATE catalog_moderation_queue SET admin_status='rejected',admin_user_id=?,admin_note=?,reviewed_at=?,updated_at=? WHERE id=?")
      .bind(admin.id,note,now,now,row.id).run();
    await env.DB.prepare("UPDATE bottle_submissions SET status='cancelled',image_choice='admin_rejected',published_key=NULL,updated_at=? WHERE id=?")
      .bind(now,row.submission_id).run();
    return {ok:true,status:"rejected"};
  }
  const existing=await env.DB.prepare("SELECT bottle_id FROM catalog_bottles WHERE bottle_id=? AND status='published'").bind(row.bottle_id).first();
  if(existing) return {error:"catalog_entry_locked",status:409,message:"Published records are immutable to community submissions."};
  const published=await publishModeratedAsset(env,row);
  await env.DB.prepare("INSERT INTO catalog_bottles (bottle_id,bottle_name,bottle_data,image_submission_id,image_key,asset_sha256,license_version,licensed_at,provenance_submission_id,source_user_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,'published',?,?)")
    .bind(row.bottle_id,row.bottle_name,row.bottle_data,row.submission_id,published.image_key,published.asset_sha256,CATALOG_LICENSE_VERSION,now,row.submission_id,row.user_id,now,now).run();
  await recordCatalogReceipt(env,{id:row.user_id},{id:row.submission_id,bottle_id:row.bottle_id,original_deleted_at:row.original_deleted_at},published,now);
  await env.DB.prepare("UPDATE catalog_moderation_queue SET admin_status='approved',admin_user_id=?,admin_note=?,reviewed_at=?,updated_at=? WHERE id=?")
    .bind(admin.id,note,now,now,row.id).run();
  await env.DB.prepare("UPDATE bottle_submissions SET status='published',image_choice='admin_approved',published_key=?,asset_sha256=?,updated_at=? WHERE id=?")
    .bind(published.image_key,published.asset_sha256,now,row.submission_id).run();
  if(row.review_image_key&&env.BOTTLE_IMAGES) await env.BOTTLE_IMAGES.delete(row.review_image_key).catch(function(){});
  _communityDb={d:null,at:0};
  const catalogRow=await env.DB.prepare("SELECT * FROM catalog_bottles WHERE bottle_id=?").bind(row.bottle_id).first();
  return {ok:true,status:"approved",bottle:publicCatalogBottle(catalogRow,request)};
}
async function ensureCatalogSystemUser(env){
  const now=new Date().toISOString();
  const cols=await userColumns(env);
  if(cols.email_verified_at){
    await env.DB.prepare("INSERT OR IGNORE INTO users (id,email,username,password_hash,password_salt,password_algo,birth_date,age_gate_country,age_gate_min,age_verified_at,email_verified_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(CATALOG_SYSTEM_USER_ID,"catalog-system@bourbon-hunters.invalid","catalog_system","disabled","disabled","disabled",null,"system",18,now,now,now,now).run();
  }else{
    await env.DB.prepare("INSERT OR IGNORE INTO users (id,email,username,password_hash,password_salt,password_algo,birth_date,age_gate_country,age_gate_min,age_verified_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(CATALOG_SYSTEM_USER_ID,"catalog-system@bourbon-hunters.invalid","catalog_system","disabled","disabled","disabled",null,"system",18,now,now,now).run();
  }
}
async function permanentCatalogImage(env, row){
  const sourceKey=String(row.image_key||row.processed_key||"");
  if(!sourceKey || !env.BOTTLE_IMAGES) return {image_key:sourceKey||null,asset_sha256:row.asset_sha256||row.submission_asset_sha256||null,legacy_key:null};
  if(sourceKey.indexOf("catalog/published/")===0) return {image_key:sourceKey,asset_sha256:row.asset_sha256||row.submission_asset_sha256||null,legacy_key:null};
  const object=await env.BOTTLE_IMAGES.get(sourceKey);
  if(!object) return {image_key:null,asset_sha256:null,legacy_key:sourceKey};
  const bytes=new Uint8Array(await object.arrayBuffer());
  const assetSha=row.asset_sha256||row.submission_asset_sha256||await sha256Bytes(bytes);
  const imageKey="catalog/published/"+cleanCatalogId(row.bottle_id)+"/"+assetSha+".webp";
  await env.BOTTLE_IMAGES.put(imageKey,bytes,{httpMetadata:{contentType:"image/webp",cacheControl:"public, max-age=31536000, immutable"}});
  return {image_key:imageKey,asset_sha256:assetSha,legacy_key:sourceKey};
}
async function deleteAccountAndData(env, user){
  if(!(await catalogDataSchemaReady(env))) return {error:"schema_catalog_lifecycle_missing",status:501};
  await ensureCatalogSystemUser(env);
  const now=new Date().toISOString();
  const contributorHash=await sha256Hex("catalog-contributor:"+user.id);
  const rows=await env.DB.prepare("SELECT cb.bottle_id,cb.image_key,cb.asset_sha256,cb.image_submission_id,bs.original_key,bs.processed_key,bs.asset_sha256 AS submission_asset_sha256 FROM catalog_bottles cb LEFT JOIN bottle_submissions bs ON bs.id=cb.image_submission_id WHERE cb.source_user_id=? OR bs.user_id=?")
    .bind(user.id,user.id).all();
  const keepKeys={};
  let retainedAssets=0;
  for(const row of (rows.results||[])){
    const asset=await permanentCatalogImage(env,row);
    if(asset.image_key){ keepKeys[asset.image_key]=true; retainedAssets++; }
    await env.DB.prepare("UPDATE catalog_bottles SET image_key=?,asset_sha256=COALESCE(?,asset_sha256),image_submission_id=NULL,source_user_id=?,updated_at=? WHERE bottle_id=?")
      .bind(asset.image_key,asset.asset_sha256,CATALOG_SYSTEM_USER_ID,now,row.bottle_id).run();
    if(asset.legacy_key && asset.legacy_key!==asset.image_key && env.BOTTLE_IMAGES) await env.BOTTLE_IMAGES.delete(asset.legacy_key).catch(function(){});
  }
  const submissions=await env.DB.prepare("SELECT original_key,processed_key,published_key FROM bottle_submissions WHERE user_id=?").bind(user.id).all();
  if(env.BOTTLE_IMAGES){
    const deleteKeys=[];
    (submissions.results||[]).forEach(function(row){
      [row.original_key,row.processed_key].filter(Boolean).forEach(function(key){ if(!keepKeys[key] && deleteKeys.indexOf(key)<0) deleteKeys.push(key); });
    });
    if(await catalogModerationSchemaReady(env)){
      const reviews=await env.DB.prepare("SELECT mq.review_image_key FROM catalog_moderation_queue mq JOIN bottle_submissions bs ON bs.id=mq.submission_id WHERE bs.user_id=? AND mq.admin_status='pending'").bind(user.id).all();
      (reviews.results||[]).forEach(function(row){ if(row.review_image_key&&!keepKeys[row.review_image_key]&&deleteKeys.indexOf(row.review_image_key)<0) deleteKeys.push(row.review_image_key); });
    }
    if(deleteKeys.length) await deleteR2Keys(env,deleteKeys);
  }
  await env.DB.prepare("UPDATE catalog_asset_receipts SET account_deleted_at=?,updated_at=? WHERE contributor_hash=?").bind(now,now,contributorHash).run();
  if(await telemetrySchemaReady(env)){
    await env.DB.prepare("UPDATE scanner_runs SET user_id=NULL,actor_type='deleted' WHERE user_id=?").bind(user.id).run();
    await env.DB.prepare("UPDATE service_usage_events SET user_id=NULL WHERE user_id=?").bind(user.id).run();
    await env.DB.prepare("UPDATE telemetry_events SET user_id=NULL WHERE user_id=?").bind(user.id).run();
  }
  await env.DB.prepare("DELETE FROM users WHERE id=?").bind(user.id).run();
  return {ok:true,account_deleted:true,retained_catalog_assets:retainedAssets,deleted_at:now};
}
function defaultProfile(){ return {badge:"glass"}; }
async function profileFor(env, userId){
  if(!(await tableExists(env,"user_profiles"))) return defaultProfile();
  const row=await env.DB.prepare("SELECT badge,display_name,created_at,updated_at FROM user_profiles WHERE user_id=?").bind(userId).first();
  if(!row) return defaultProfile();
  return {
    badge: cleanProfileBadge(row.badge),
    display_name: row.display_name || "",
    created_at: row.created_at || "",
    updated_at: row.updated_at || ""
  };
}
async function upsertProfile(env, userId, body){
  if(!(await tableExists(env,"user_profiles"))) return null;
  const badge=cleanProfileBadge(body&&body.badge);
  const displayName=String((body&&body.display_name)||"").trim().slice(0,60);
  const now=new Date().toISOString();
  await env.DB.prepare("INSERT INTO user_profiles (user_id,badge,display_name,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET badge=excluded.badge,display_name=excluded.display_name,updated_at=excluded.updated_at")
    .bind(userId,badge,displayName,now,now).run();
  return profileFor(env,userId);
}
async function suggestUsernames(env, desired, email){
  const base=usernameBase(desired,email);
  const pool=[
    base+"_hunter",
    base+"_barrel",
    base+"_bh",
    base+"_88",
    base+"_21",
    base+"_"+new Date().getUTCFullYear(),
    "bourbon_"+base
  ];
  const out=[];
  for(let i=0;i<pool.length && out.length<5;i++){
    const name=pool[i].slice(0,40);
    const taken=await env.DB.prepare("SELECT id FROM users WHERE username=?").bind(name).first();
    if(!taken && out.indexOf(name)<0) out.push(name);
  }
  for(let i=2;out.length<5 && i<200;i++){
    const name=(base+"_"+i).slice(0,40);
    const taken=await env.DB.prepare("SELECT id FROM users WHERE username=?").bind(name).first();
    if(!taken) out.push(name);
  }
  return out;
}
async function availableUsername(env, desired, email){
  const base=usernameBase(desired,email);
  const first=base.slice(0,40);
  const firstTaken=first.length>=2 ? await env.DB.prepare("SELECT id FROM users WHERE username=?").bind(first).first() : true;
  if(first.length>=2 && !firstTaken) return first;
  const suggestions=await suggestUsernames(env,base,email);
  return suggestions[0] || ("hunter_"+randHex(3));
}
async function createSession(env, request, userId){
  const token=randHex(32);
  const tokenHash=await sha256Hex(token);
  const now=new Date();
  const expires=new Date(now.getTime()+1000*60*60*24*30);
  await env.DB.prepare("INSERT INTO sessions (id,user_id,token_hash,created_at,expires_at,user_agent,ip) VALUES (?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), userId, tokenHash, now.toISOString(), expires.toISOString(), request.headers.get("User-Agent")||"", request.headers.get("CF-Connecting-IP")||"").run();
  return token;
}
async function createEmailVerification(env, request, user){
  const now=new Date();
  const expires=new Date(now.getTime()+1000*60*60*24);
  const rawToken=randHex(32);
  const tokenHash=await sha256Hex(rawToken);
  await env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_id=? OR expires_at<? OR used_at IS NOT NULL")
    .bind(user.id,now.toISOString()).run();
  await env.DB.prepare("INSERT INTO email_verification_tokens (id,user_id,token_hash,created_at,expires_at,ip,user_agent) VALUES (?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),user.id,tokenHash,now.toISOString(),expires.toISOString(),request.headers.get("CF-Connecting-IP")||"",request.headers.get("User-Agent")||"").run();
  const verifyUrl=appUrl(env)+"?verify_email="+encodeURIComponent(rawToken);
  const mail=await sendEmailVerification(env,user,verifyUrl);
  return {sent:!!mail.sent,expires_at:expires.toISOString()};
}
async function authUser(env, request){
  const h=request.headers.get("Authorization")||"";
  const m=h.match(/^Bearer\s+(.+)$/i);
  if(!m || !env.DB) return null;
  const tokenHash=await sha256Hex(m[1].trim());
  const hasRoles=await tableExists(env,"user_roles");
  const sql=hasRoles
    ? "SELECT users.id,users.email,users.username,users.password_hash,users.password_salt,users.password_algo,users.email_verified_at,users.age_verified_at,users.created_at,sessions.id AS session_id,sessions.created_at AS session_created_at,EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=users.id AND ur.role='admin' AND ur.revoked_at IS NULL) AS is_admin FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?"
    : "SELECT users.id,users.email,users.username,users.password_hash,users.password_salt,users.password_algo,users.created_at,sessions.id AS session_id,sessions.created_at AS session_created_at,0 AS is_admin FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?";
  const row=await env.DB.prepare(sql).bind(tokenHash,new Date().toISOString()).first();
  return row||null;
}
async function accountDeletionReauth(user, body){
  if(!user) return {ok:false,error:"reauth_required"};
  if(user.password_algo==="google-oauth2"){
    const sessionAge=Date.now()-Date.parse(String(user.session_created_at||""));
    return Number.isFinite(sessionAge) && sessionAge>=0 && sessionAge<=1000*60*10
      ? {ok:true}
      : {ok:false,error:"google_reauth_required"};
  }
  const password=String(body&&body.password||"");
  if(!password || password.length>128) return {ok:false,error:"password_reauth_required"};
  const hash=await hashPassword(password,user.password_salt,passwordIterations(user.password_algo));
  return constantTimeHexEqual(hash,user.password_hash)
    ? {ok:true}
    : {ok:false,error:"password_reauth_failed"};
}
async function privateBottleSchemaReady(env){
  return !!(env.DB && await tableExists(env,"user_private_bottles"));
}
let ugcModerationSchemaCache={checkedAt:0,ready:false};
async function ugcModerationSchemaReady(env){
  const now=Date.now();
  if(now-ugcModerationSchemaCache.checkedAt<30000) return ugcModerationSchemaCache.ready;
  let ready=false;
  if(env.DB && await tableExists(env,"comment_reports") && await tableExists(env,"user_blocks") && await tableExists(env,"comment_moderation_actions")){
    const columns=await tableColumns(env,"bottle_recommendations");
    ready=!!columns.moderation_status;
  }
  ugcModerationSchemaCache={checkedAt:now,ready:ready};
  return ready;
}
function privateBottleText(value, max){
  return String(value==null?"":value).replace(/\s+/g," ").trim().slice(0,max);
}
function privateBottleNumber(value, min, max){
  if(value==null || value==="") return null;
  const number=Number(value);
  return Number.isFinite(number) && number>=min && number<=max ? Math.round(number*10)/10 : null;
}
function privateBottleFromRow(row){
  if(!row) return null;
  return {
    id:row.id,name:row.name,distillery:row.distillery||"",category:row.category||"Other",
    type:row.type||row.category||"Other",region:row.region||"",abv:row.abv==null?null:Number(row.abv),
    proof:row.proof==null?null:Number(row.proof),price_range:row.price_range||"",
    general:row.general_info||"",desc:row.general_info||"",nose:row.nose||"",taste:row.taste||"",
    finish:row.finish||"",mashbill:row.mashbill||"",image:"",source:"private_user",
    catalog_status:"private",private:true,owner_only:true,created_at:row.created_at,updated_at:row.updated_at
  };
}
async function privateBottlesFor(env, userId){
  if(!(await privateBottleSchemaReady(env))) return [];
  const result=await env.DB.prepare("SELECT * FROM user_private_bottles WHERE user_id=? ORDER BY updated_at DESC LIMIT 300").bind(userId).all();
  return (result.results||[]).map(privateBottleFromRow).filter(Boolean);
}
async function savePrivateBottle(env, user, body){
  if(!(await privateBottleSchemaReady(env))) return {error:"private_bottle_schema_missing",status:501};
  const name=privateBottleText(body&&body.name,160);
  if(name.length<2) return {error:"private_bottle_name_required",status:400};
  let id=privateBottleText(body&&body.id,180);
  if(id){
    const owned=await env.DB.prepare("SELECT id FROM user_private_bottles WHERE id=? AND user_id=?").bind(id,user.id).first();
    if(!owned) return {error:"private_bottle_not_found",status:404};
  }else{
    id="private-"+String(user.id).slice(0,12)+"-"+crypto.randomUUID();
  }
  const abv=privateBottleNumber(body&&body.abv,0,96);
  const proof=privateBottleNumber(body&&body.proof,0,192);
  if(body&&body.abv!=="" && body&&body.abv!=null && abv==null) return {error:"private_bottle_abv_invalid",status:400};
  if(body&&body.proof!=="" && body&&body.proof!=null && proof==null) return {error:"private_bottle_proof_invalid",status:400};
  const now=new Date().toISOString();
  const values={
    distillery:privateBottleText(body&&body.distillery,160),category:privateBottleText(body&&body.category,80)||"Other",
    type:privateBottleText(body&&body.type,100),region:privateBottleText(body&&body.region,100),
    price_range:privateBottleText(body&&body.price_range,80),general_info:privateBottleText(body&&(body.general_info||body.general||body.desc),1200),
    nose:privateBottleText(body&&body.nose,500),taste:privateBottleText(body&&body.taste,500),
    finish:privateBottleText(body&&body.finish,500),mashbill:privateBottleText(body&&body.mashbill,500)
  };
  await env.DB.prepare("INSERT INTO user_private_bottles (id,user_id,name,distillery,category,type,region,abv,proof,price_range,general_info,nose,taste,finish,mashbill,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,distillery=excluded.distillery,category=excluded.category,type=excluded.type,region=excluded.region,abv=excluded.abv,proof=excluded.proof,price_range=excluded.price_range,general_info=excluded.general_info,nose=excluded.nose,taste=excluded.taste,finish=excluded.finish,mashbill=excluded.mashbill,updated_at=excluded.updated_at")
    .bind(id,user.id,name,values.distillery,values.category,values.type,values.region,abv,proof,values.price_range,values.general_info,values.nose,values.taste,values.finish,values.mashbill,now,now).run();
  const row=await env.DB.prepare("SELECT * FROM user_private_bottles WHERE id=? AND user_id=?").bind(id,user.id).first();
  await upsertBottleList(env,user.id,"collection",id,true,privateBottleFromRow(row));
  return {ok:true,bottle:privateBottleFromRow(row)};
}
async function bootstrapFor(env, userId){
  const bottles=await env.DB.prepare("SELECT bottle_id,list_type FROM user_bottles WHERE user_id=?").bind(userId).all();
  const ratings=await env.DB.prepare("SELECT bottle_id,rating FROM user_ratings WHERE user_id=?").bind(userId).all();
  const out={wishlist:[],collection:[],ratings:{},recommendations_count:0,private_bottles:await privateBottlesFor(env,userId)};
  (bottles.results||[]).forEach(function(r){
    if(r.list_type==="wishlist") out.wishlist.push(r.bottle_id);
    if(r.list_type==="collection") out.collection.push(r.bottle_id);
  });
  (ratings.results||[]).forEach(function(r){ out.ratings[r.bottle_id]=r.rating; });
  if(await tableExists(env,"bottle_recommendations")){
    const rec=await env.DB.prepare("SELECT COUNT(*) AS count FROM bottle_recommendations WHERE user_id=? AND active=1").bind(userId).first();
    out.recommendations_count=Number(rec&&rec.count)||0;
  }
  return out;
}
async function upsertBottleList(env, userId, listType, bottleId, active, data){
  if(!bottleId) return;
  if(!active){
    await env.DB.prepare("DELETE FROM user_bottles WHERE user_id=? AND bottle_id=? AND list_type=?").bind(userId,bottleId,listType).run();
    return;
  }
  const now=new Date().toISOString();
  const bottleName=String((data&&data.name)||"").slice(0,160);
  const bottleData=data ? JSON.stringify(data).slice(0,20000) : "";
  await env.DB.prepare("INSERT INTO user_bottles (user_id,bottle_id,list_type,bottle_name,bottle_data,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,bottle_id,list_type) DO UPDATE SET bottle_name=excluded.bottle_name,bottle_data=excluded.bottle_data,updated_at=excluded.updated_at")
    .bind(userId,bottleId,listType,bottleName,bottleData,now,now).run();
}
async function upsertRating(env, userId, bottleId, rating){
  const n=Math.max(1,Math.min(5,Math.round(Number(rating)||0)));
  if(!bottleId || !n) return;
  const now=new Date().toISOString();
  await env.DB.prepare("INSERT INTO user_ratings (user_id,bottle_id,rating,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,bottle_id) DO UPDATE SET rating=excluded.rating,updated_at=excluded.updated_at")
    .bind(userId,bottleId,n,now,now).run();
}
function cleanBottleIds(value){
  const raw=Array.isArray(value) ? value : String(value||"").split(",");
  const seen={};
  return raw.map(function(id){ return String(id||"").trim().slice(0,180); })
    .filter(function(id){ if(!id || seen[id]) return false; seen[id]=1; return true; })
    .slice(0,90);
}
async function ratingAggregateFor(env, bottleId){
  bottleId=String(bottleId||"").trim();
  if(!bottleId) return {avg:null,count:0};
  const row=await env.DB.prepare("SELECT COUNT(*) AS count, AVG(rating) AS avg FROM user_ratings WHERE bottle_id=?").bind(bottleId).first();
  const count=Number(row&&row.count)||0;
  const avg=count ? Math.round((Number(row.avg)||0)*10)/10 : null;
  return {avg:avg,count:count};
}
async function ratingAggregatesFor(env, ids){
  const cleanIds=cleanBottleIds(ids);
  const out={};
  cleanIds.forEach(function(id){ out[id]={avg:null,count:0}; });
  if(!cleanIds.length) return out;
  const placeholders=cleanIds.map(function(){ return "?"; }).join(",");
  const rows=await env.DB.prepare("SELECT bottle_id, COUNT(*) AS count, AVG(rating) AS avg FROM user_ratings WHERE bottle_id IN ("+placeholders+") GROUP BY bottle_id").bind(...cleanIds).all();
  (rows.results||[]).forEach(function(row){
    const count=Number(row&&row.count)||0;
    out[row.bottle_id]={avg:count?Math.round((Number(row.avg)||0)*10)/10:null,count:count};
  });
  return out;
}
function cleanRecommendationComment(v){
  return String(v||"").replace(/\s+/g," ").trim().slice(0,700);
}
async function recommendationsFor(env, bottleId, limit, viewerId){
  if(!(await tableExists(env,"bottle_recommendations"))) return {ready:false,recommendations:[]};
  const hasProfiles=await tableExists(env,"user_profiles");
  const moderated=await ugcModerationSchemaReady(env);
  limit=Math.max(1,Math.min(100,Number(limit)||40));
  const selectProfile=hasProfiles ? "COALESCE(up.badge,'glass') AS badge" : "'glass' AS badge";
  const joinProfile=hasProfiles ? " LEFT JOIN user_profiles up ON up.user_id=br.user_id" : "";
  const moderationFilter=moderated ? " AND br.moderation_status='active'" : "";
  const blockFilter=moderated&&viewerId ? " AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE (ub.blocker_user_id=? AND ub.blocked_user_id=br.user_id) OR (ub.blocker_user_id=br.user_id AND ub.blocked_user_id=?))" : "";
  const base="SELECT br.id,br.user_id,br.bottle_id,br.bottle_name,br.rating,br.comment,br.created_at,br.updated_at,u.username,"+selectProfile+" FROM bottle_recommendations br JOIN users u ON u.id=br.user_id"+joinProfile+" WHERE br.active=1"+moderationFilter+blockFilter;
  const sql=bottleId ? base+" AND br.bottle_id=? ORDER BY br.updated_at DESC LIMIT ?" : base+" ORDER BY br.updated_at DESC LIMIT ?";
  const stmt=env.DB.prepare(sql);
  const bindings=[];
  if(moderated&&viewerId) bindings.push(viewerId,viewerId);
  if(bottleId) bindings.push(String(bottleId||"").slice(0,180));
  bindings.push(limit);
  const rows=await stmt.bind(...bindings).all();
  return {ready:true,recommendations:(rows.results||[]).map(function(r){
    return {
      id:r.id,
      bottle_id:r.bottle_id,
      bottle_name:r.bottle_name,
      username:r.username,
      badge:cleanProfileBadge(r.badge),
      rating:Number(r.rating)||0,
      comment:r.comment||"",
      is_own:!!(viewerId&&r.user_id===viewerId),
      created_at:r.created_at,
      updated_at:r.updated_at
    };
  })};
}
async function upsertRecommendation(env, user, body){
  if(!(await tableExists(env,"bottle_recommendations"))) return null;
  const bottleId=String((body&&body.bottle_id)||"").trim().slice(0,180);
  const comment=cleanRecommendationComment(body&&body.comment);
  const rating=Math.max(1,Math.min(5,Math.round(Number(body&&body.rating)||0)));
  if(!bottleId || comment.length<3 || !rating) return {error:"bad_recommendation"};
  const bottleName=String((body&&body.bottle_name)||"").trim().slice(0,180);
  const now=new Date().toISOString();
  const id=crypto.randomUUID();
  const moderated=await ugcModerationSchemaReady(env);
  if(moderated){
    const existing=await env.DB.prepare("SELECT moderation_status FROM bottle_recommendations WHERE user_id=? AND bottle_id=?").bind(user.id,bottleId).first();
    if(existing&&["hidden","removed"].indexOf(existing.moderation_status)>=0) return {error:"recommendation_moderated"};
    await env.DB.prepare("INSERT INTO bottle_recommendations (id,user_id,bottle_id,bottle_name,rating,comment,active,moderation_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,bottle_id) DO UPDATE SET bottle_name=excluded.bottle_name,rating=excluded.rating,comment=excluded.comment,active=1,moderation_status='active',updated_at=excluded.updated_at")
      .bind(id,user.id,bottleId,bottleName,rating,comment,1,"active",now,now).run();
  }else{
    await env.DB.prepare("INSERT INTO bottle_recommendations (id,user_id,bottle_id,bottle_name,rating,comment,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,bottle_id) DO UPDATE SET bottle_name=excluded.bottle_name,rating=excluded.rating,comment=excluded.comment,active=1,updated_at=excluded.updated_at")
      .bind(id,user.id,bottleId,bottleName,rating,comment,1,now,now).run();
  }
  await upsertRating(env,user.id,bottleId,rating);
  const recs=await recommendationsFor(env,bottleId,20,user.id);
  const mine=(recs.recommendations||[]).filter(function(r){ return r.is_own; })[0] || null;
  return mine;
}
async function reportRecommendation(env, user, body){
  if(!(await ugcModerationSchemaReady(env))) return {error:"ugc_moderation_schema_missing",status:501};
  const recommendationId=String(body&&body.recommendation_id||"").trim().slice(0,80);
  const reason=String(body&&body.reason||"inappropriate").trim().slice(0,40);
  const detail=String(body&&body.detail||"").replace(/\s+/g," ").trim().slice(0,500);
  if(!recommendationId || ["spam","abuse","inappropriate","copyright","other"].indexOf(reason)<0) return {error:"bad_report",status:400};
  const recommendation=await env.DB.prepare("SELECT id,user_id FROM bottle_recommendations WHERE id=?").bind(recommendationId).first();
  if(!recommendation) return {error:"recommendation_not_found",status:404};
  if(recommendation.user_id===user.id) return {error:"cannot_report_own_comment",status:400};
  const since=new Date(Date.now()-86400000).toISOString();
  const count=await env.DB.prepare("SELECT COUNT(*) AS count FROM comment_reports WHERE reporter_user_id=? AND created_at>=?").bind(user.id,since).first();
  if(Number(count&&count.count)>=20) return {error:"report_rate_limited",status:429};
  const now=new Date().toISOString();
  await env.DB.prepare("INSERT INTO comment_reports (id,recommendation_id,reporter_user_id,reason,detail,status,created_at) VALUES (?,?,?,?,?,'pending',?) ON CONFLICT(recommendation_id,reporter_user_id) DO UPDATE SET reason=excluded.reason,detail=excluded.detail,status='pending',created_at=excluded.created_at,resolved_at=NULL,resolved_by=NULL")
    .bind(crypto.randomUUID(),recommendationId,user.id,reason,detail,now).run();
  await env.DB.prepare("UPDATE bottle_recommendations SET moderation_status='reported' WHERE id=? AND moderation_status='active'").bind(recommendationId).run();
  return {ok:true};
}
async function blockRecommendationUser(env, user, body){
  if(!(await ugcModerationSchemaReady(env))) return {error:"ugc_moderation_schema_missing",status:501};
  const recommendationId=String(body&&body.recommendation_id||"").trim().slice(0,80);
  if(!recommendationId) return {error:"bad_block",status:400};
  const recommendation=await env.DB.prepare("SELECT user_id FROM bottle_recommendations WHERE id=?").bind(recommendationId).first();
  if(!recommendation) return {error:"recommendation_not_found",status:404};
  const blockedUserId=String(recommendation.user_id||"");
  if(!blockedUserId || blockedUserId===user.id) return {error:"bad_block",status:400};
  const count=await env.DB.prepare("SELECT COUNT(*) AS count FROM user_blocks WHERE blocker_user_id=?").bind(user.id).first();
  if(Number(count&&count.count)>=1000) return {error:"block_limit",status:409};
  await env.DB.prepare("INSERT OR IGNORE INTO user_blocks (blocker_user_id,blocked_user_id,created_at) VALUES (?,?,?)").bind(user.id,blockedUserId,new Date().toISOString()).run();
  return {ok:true};
}
async function adminCommentModerationList(env, limit){
  limit=Math.max(1,Math.min(100,Number(limit)||40));
  const rows=await env.DB.prepare("SELECT br.id,br.user_id,br.bottle_id,br.bottle_name,br.rating,br.comment,br.moderation_status,br.updated_at,u.username,COUNT(cr.id) AS report_count,MIN(cr.created_at) AS first_reported_at,GROUP_CONCAT(DISTINCT cr.reason) AS reasons FROM bottle_recommendations br JOIN users u ON u.id=br.user_id JOIN comment_reports cr ON cr.recommendation_id=br.id AND cr.status='pending' GROUP BY br.id ORDER BY report_count DESC,first_reported_at ASC LIMIT ?").bind(limit).all();
  return {items:rows.results||[]};
}
async function adminCommentModerationDecision(env, admin, recommendationId, body){
  const action=String(body&&body.action||"").trim();
  const note=String(body&&body.note||"").replace(/\s+/g," ").trim().slice(0,500);
  if(["dismiss","hide","remove"].indexOf(action)<0) return {error:"bad_moderation_action",status:400};
  const recommendation=await env.DB.prepare("SELECT id FROM bottle_recommendations WHERE id=?").bind(recommendationId).first();
  if(!recommendation) return {error:"recommendation_not_found",status:404};
  const now=new Date().toISOString();
  const status=action==="dismiss"?"active":action==="hide"?"hidden":"removed";
  await env.DB.batch([
    env.DB.prepare("UPDATE bottle_recommendations SET active=?,moderation_status=?,updated_at=? WHERE id=?").bind(action==="dismiss"?1:0,status,now,recommendationId),
    env.DB.prepare("UPDATE comment_reports SET status=?,resolved_at=?,resolved_by=? WHERE recommendation_id=? AND status='pending'").bind(action==="dismiss"?"dismissed":"actioned",now,admin.id,recommendationId),
    env.DB.prepare("INSERT INTO comment_moderation_actions (id,recommendation_id,admin_user_id,action,note,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),recommendationId,admin.id,action,note,now)
  ]);
  return {ok:true,status:status};
}
async function googleExchange(request, env, code){
  const body=new URLSearchParams();
  body.set("code",code);
  body.set("client_id",String(env.GOOGLE_CLIENT_ID));
  body.set("client_secret",String(env.GOOGLE_CLIENT_SECRET));
  body.set("redirect_uri",googleRedirectUri(env,request));
  body.set("grant_type","authorization_code");
  const tokenRes=await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:body.toString()
  });
  const tokenData=await tokenRes.json().catch(function(){ return {}; });
  if(!tokenRes.ok || !tokenData.access_token) throw {error:"google_token_failed",detail:String(tokenData.error_description||tokenData.error||tokenRes.status).slice(0,180)};
  const userRes=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{
    headers:{"Authorization":"Bearer "+tokenData.access_token}
  });
  const userData=await userRes.json().catch(function(){ return {}; });
  if(!userRes.ok || !userData.sub) throw {error:"google_user_failed",detail:String(userData.error_description||userData.error||userRes.status).slice(0,180)};
  return userData;
}
function googleAuthorizationUrl(request, env, state){
  const googleUrl=new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleUrl.searchParams.set("client_id",String(env.GOOGLE_CLIENT_ID));
  googleUrl.searchParams.set("redirect_uri",googleRedirectUri(env,request));
  googleUrl.searchParams.set("response_type","code");
  googleUrl.searchParams.set("scope","openid email profile");
  googleUrl.searchParams.set("state",state);
  googleUrl.searchParams.set("prompt","select_account");
  return googleUrl.toString();
}
async function createGoogleLinkRequest(env, request, user, returnUrl){
  if(!(await authSecuritySchemaReady(env))) throw {error:"schema_auth_security_missing"};
  const now=new Date();
  const expires=new Date(now.getTime()+1000*60*10);
  const id=crypto.randomUUID();
  const nonce=randHex(24);
  const nonceHash=await sha256Hex(nonce);
  await env.DB.prepare("DELETE FROM auth_link_requests WHERE user_id=? OR expires_at<? OR used_at IS NOT NULL")
    .bind(user.id,now.toISOString()).run();
  await env.DB.prepare("INSERT INTO auth_link_requests (id,user_id,session_id,provider,nonce_hash,return_url,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id,user.id,user.session_id,"google",nonceHash,returnUrl,now.toISOString(),expires.toISOString()).run();
  const state=await makeGoogleState(env,{mode:"link",link_id:id,nonce:nonce,return_url:returnUrl,iat:Date.now()});
  return googleAuthorizationUrl(request,env,state);
}
async function completeGoogleLink(env, state, googleUser){
  if(!(await authSecuritySchemaReady(env))) throw {error:"schema_auth_security_missing"};
  const providerId=String(googleUser.sub||"").trim();
  const email=cleanEmail(googleUser.email);
  if(!providerId || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw {error:"bad_google_profile"};
  if(googleUser.email_verified===false || googleUser.email_verified==="false") throw {error:"google_email_unverified"};
  const now=new Date().toISOString();
  const link=await env.DB.prepare("SELECT alr.*,u.email AS user_email FROM auth_link_requests alr JOIN users u ON u.id=alr.user_id JOIN sessions s ON s.id=alr.session_id AND s.user_id=alr.user_id WHERE alr.id=? AND alr.provider='google' AND alr.used_at IS NULL AND alr.expires_at>? AND s.expires_at>?")
    .bind(String(state.link_id||""),now,now).first();
  if(!link || !constantTimeHexEqual(await sha256Hex(String(state.nonce||"")),link.nonce_hash)) throw {error:"google_link_expired"};
  if(cleanEmail(link.user_email)!==email) throw {error:"google_link_email_mismatch"};
  const existing=await env.DB.prepare("SELECT user_id FROM auth_identities WHERE provider='google' AND provider_user_id=?").bind(providerId).first();
  if(existing && existing.user_id!==link.user_id) throw {error:"google_identity_in_use"};
  await env.DB.prepare("INSERT INTO auth_identities (provider,provider_user_id,user_id,email,created_at,updated_at) VALUES ('google',?,?,?,?,?) ON CONFLICT(provider,provider_user_id) DO UPDATE SET email=excluded.email,updated_at=excluded.updated_at")
    .bind(providerId,link.user_id,email,now,now).run();
  await env.DB.prepare("UPDATE users SET email_verified_at=COALESCE(email_verified_at,?),updated_at=? WHERE id=?").bind(now,now,link.user_id).run();
  await env.DB.prepare("UPDATE auth_link_requests SET used_at=? WHERE id=?").bind(now,link.id).run();
  return {ok:true,user_id:link.user_id};
}
async function googleUserLogin(env, request, googleUser){
  if(!(await authSecuritySchemaReady(env))) throw {error:"schema_auth_security_missing"};
  const provider="google";
  const providerId=String(googleUser.sub||"").trim();
  const email=cleanEmail(googleUser.email);
  if(!providerId || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw {error:"bad_google_profile"};
  if(googleUser.email_verified===false || googleUser.email_verified==="false") throw {error:"google_email_unverified"};
  const now=new Date().toISOString();
  let row=await env.DB.prepare("SELECT u.* FROM auth_identities ai JOIN users u ON u.id=ai.user_id WHERE ai.provider=? AND ai.provider_user_id=?")
    .bind(provider,providerId).first();
  let created=false;
  if(!row){
    const emailOwner=await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
    if(emailOwner) throw {error:"google_account_exists_unlinked"};
    const id=crypto.randomUUID();
    const salt=randHex(16);
    const hash=await sha256Hex("google:"+providerId+":"+randHex(16));
    const username=await availableUsername(env,googleUser.name||email,email);
    await env.DB.prepare("INSERT INTO users (id,email,username,password_hash,password_salt,password_algo,birth_date,age_gate_country,age_gate_min,age_verified_at,email_verified_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,email,username,hash,salt,"google-oauth2",null,"google",ageGateMin(env),now,now,now,now).run();
    row=await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first();
    created=true;
    await env.DB.prepare("INSERT INTO auth_identities (provider,provider_user_id,user_id,email,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(provider,provider_user_id) DO UPDATE SET user_id=excluded.user_id,email=excluded.email,updated_at=excluded.updated_at")
      .bind(provider,providerId,row.id,email,now,now).run();
  } else if(row.email!==email){
    await env.DB.prepare("UPDATE auth_identities SET email=?,updated_at=? WHERE provider=? AND provider_user_id=?")
      .bind(email,now,provider,providerId).run();
  }
  await attachRoleFlags(env,row);
  const token=await createSession(env,request,row.id);
  if(created) sendWelcomeEmail(env,{email:row.email,username:row.username}).catch(function(){});
  return {token:token,user:publicUser(row),bootstrap:await bootstrapFor(env,row.id),profile:await profileFor(env,row.id),admin:isAdminUser(env,row),created:created};
}
function reportDays(url){ return [7,30,90].indexOf(Number(url.searchParams.get("days")))>=0 ? Number(url.searchParams.get("days")) : 30; }
async function adminReportSummary(env, days){
  const since=new Date(Date.now()-days*86400000).toISOString();
  const scanner=await env.DB.prepare("SELECT COUNT(*) AS scans,COUNT(DISTINCT user_id) AS users,COUNT(DISTINCT device_hash) AS devices,ROUND(AVG(duration_ms),0) AS avg_duration_ms,ROUND(AVG(confidence),3) AS avg_confidence,SUM(CASE WHEN confirmed_at IS NOT NULL THEN 1 ELSE 0 END) AS confirmations,SUM(CASE WHEN outcome='confirmed_top' THEN 1 ELSE 0 END) AS confirmed_top,SUM(CASE WHEN outcome='confirmed_alternate' THEN 1 ELSE 0 END) AS confirmed_alternate,SUM(CASE WHEN outcome='cancelled' THEN 1 ELSE 0 END) AS cancelled,SUM(CASE WHEN outcome='candidates_presented' AND confirmed_at IS NULL THEN 1 ELSE 0 END) AS unconfirmed FROM scanner_runs WHERE created_at>=?").bind(since).first();
  const outcomes=await env.DB.prepare("SELECT outcome,COUNT(*) AS count FROM scanner_runs WHERE created_at>=? GROUP BY outcome ORDER BY count DESC").bind(since).all();
  const usage=await env.DB.prepare("SELECT provider,stage,model,status,COUNT(*) AS calls,SUM(attempts) AS attempts,SUM(prompt_tokens) AS prompt_tokens,SUM(output_tokens) AS output_tokens,SUM(total_tokens) AS total_tokens,SUM(cached_tokens) AS cached_tokens,SUM(thought_tokens) AS thought_tokens,ROUND(AVG(duration_ms),0) AS avg_duration_ms FROM service_usage_events WHERE created_at>=? GROUP BY provider,stage,model,status ORDER BY calls DESC").bind(since).all();
  const activity=await env.DB.prepare("SELECT (SELECT COUNT(*) FROM users) AS users_total,(SELECT COUNT(*) FROM user_ratings WHERE created_at>=?) AS ratings,(SELECT COUNT(*) FROM bottle_recommendations WHERE created_at>=?) AS recommendations,(SELECT COUNT(*) FROM catalog_bottles WHERE created_at>=? AND status='published') AS catalog_additions").bind(since,since,since).first();
  const confirmations=Number(scanner&&scanner.confirmations)||0;
  const top=Number(scanner&&scanner.confirmed_top)||0;
  const alternate=Number(scanner&&scanner.confirmed_alternate)||0;
  return {days:days,since:since,generated_at:new Date().toISOString(),scanner:Object.assign({},scanner||{}, {
    top_choice_acceptance_proxy:confirmations ? Math.round(top/confirmations*1000)/10 : null,
    alternate_choice_correction_proxy:confirmations ? Math.round(alternate/confirmations*1000)/10 : null
  }),outcomes:outcomes.results||[],service_usage:usage.results||[],activity:activity||{},metric_note:"Acceptance is a user-confirmation proxy, not laboratory ground-truth accuracy."};
}
async function adminConfusions(env, days, limit){
  const since=new Date(Date.now()-days*86400000).toISOString();
  const rows=await env.DB.prepare("SELECT suggested_bottle_id,confirmed_bottle_id,COUNT(*) AS count,ROUND(AVG(confidence),3) AS avg_confidence FROM scanner_runs WHERE created_at>=? AND outcome='confirmed_alternate' AND suggested_bottle_id IS NOT NULL AND confirmed_bottle_id IS NOT NULL GROUP BY suggested_bottle_id,confirmed_bottle_id ORDER BY count DESC LIMIT ?")
    .bind(since,Math.max(1,Math.min(100,Number(limit)||20))).all();
  return {days:days,since:since,confusions:rows.results||[]};
}
const NEWS_SOURCES={
  "whiskyadvocate.com":"Whisky Advocate",
  "whiskymag.com":"Whisky Magazine",
  "thewhiskeywash.com":"The Whiskey Wash",
  "breakingbourbon.com":"Breaking Bourbon"
};
const NEWS_DISCOVERY_PAGES=[
  "https://whiskyadvocate.com/",
  "https://whiskyadvocate.com/Tag/Whisky%20News%20and%20Spirit%20Updates",
  "https://whiskymag.com/articles/",
  "https://thewhiskeywash.com/category/whiskey-news/",
  "https://breakingbourbon.com/"
];
const STARTER_NEWS=[
  {
    url:"https://www.whiskymag.com/articles/tormore-the-pearl-of-speyside-shines-with-core-range-launch/",
    title:"The 'Pearl of Speyside' shines with core range Tormore launch",
    excerpt_pl:"Tormore wprowadza podstawowa serie single maltow: Timeless oraz wersje 12- i 16-letnia. Nowa linia stawia na lekki, owocowy charakter destylatu zamiast dominacji beczki.",
    excerpt_en:"Tormore is launching a core single malt range: Timeless plus 12- and 16-year-old expressions. The line emphasizes the distillery's light, fruity spirit rather than heavy cask influence.",
    category:"scotch",published_at:"2026-06-15T00:00:00Z"
  },
  {
    url:"https://www.whiskymag.com/articles/inside-the-dalmores-reimagined-distillery-and-visitor-experience/",
    title:"Inside The Dalmore's reimagined distillery and visitor experience",
    excerpt_pl:"The Dalmore podwoil potencjal produkcyjny do 9 mln litrow rocznie i ponownie otworzyl sie dla gosci. Nowe wizyty maja kameralny, spersonalizowany charakter i sa kierowane do maksymalnie osmiu osob.",
    excerpt_en:"The Dalmore has doubled its potential production capacity to 9 million litres a year and reopened to visitors. Its new tours are private, tailored experiences for groups of up to eight.",
    category:"scotch",published_at:"2026-06-10T00:00:00Z"
  },
  {
    url:"https://www.whiskymag.com/articles/spirit-of-speyside-whisky-festival-celebrates-record-breaking-year/",
    title:"Spirit of Speyside Whisky Festival celebrates record-breaking year",
    excerpt_pl:"Edycja 2026 festiwalu Spirit of Speyside po raz pierwszy przekroczyla 500 tys. funtow sprzedazy. Ponad 60 procent biletow kupili goscie zagraniczni.",
    excerpt_en:"The 2026 Spirit of Speyside festival exceeded GBP 500,000 in sales for the first time. International visitors accounted for more than 60 percent of ticket sales.",
    category:"scotch",published_at:"2026-05-05T00:00:00Z"
  },
  {
    url:"https://whiskymag.com/articles/worlds-best-whiskies-announced-in-world-whiskies-awards-2026/",
    title:"World's Best whiskies announced in World Whiskies Awards 2026",
    excerpt_pl:"World Whiskies Awards 2026 pokazaly szeroki, miedzynarodowy przekroj zwyciezcow. Tytul najlepszego single malta otrzymal Bowmore 21 Years Old Sherry Cask.",
    excerpt_en:"The 2026 World Whiskies Awards highlighted winners from established and emerging whisky regions. Bowmore 21 Years Old Sherry Cask took the World's Best Single Malt title.",
    category:"world",published_at:"2026-03-25T00:00:00Z"
  },
  {
    url:"https://whiskyadvocate.com/knob-creek-blenders-edition-series-01",
    title:"Knob Creek's New Series Spotlights the Art of the Blend",
    excerpt_pl:"Knob Creek uruchamia serie Blender's Edition. Pierwsze wydanie laczy bourbony w wieku co najmniej 10 lat i skupia sie na slodkich nutach wanilii, wisni oraz syropu klonowego.",
    excerpt_en:"Knob Creek is launching its Blender's Edition series. The debut blends bourbons aged at least 10 years and focuses on sweet vanilla, cherry and maple notes.",
    category:"bourbon",published_at:"2026-04-09T00:00:00Z"
  },
  {
    url:"https://breakingbourbon.com/article/lost-lanterns-fifty-nifty-bourbon-the-story-behind-americas-first-50-state-blend",
    title:"Lost Lantern's Fifty Nifty Bourbon - The Story Behind America's First 50 State Blend",
    excerpt_pl:"Lost Lantern polaczyl bourbony pochodzace z destylarni ze wszystkich 50 stanow. Material pokazuje, jak ambitny projekt kupazowania zamieniono w spojna butelke zamiast kolekcjonerskiego eksperymentu.",
    excerpt_en:"Lost Lantern combined bourbon sourced from distilleries across all 50 states. The story explains how the ambitious blending project became a cohesive whiskey rather than a novelty release.",
    category:"bourbon",published_at:"2026-07-01T00:00:00Z"
  }
];
function newsSourceForUrl(value){
  try{
    const host=new URL(String(value||"")).hostname.toLowerCase().replace(/^www\./,"");
    return NEWS_SOURCES[host]||"";
  }catch(e){ return ""; }
}
function canonicalNewsUrl(value){
  try{
    const url=new URL(String(value||""));
    if(url.protocol!=="https:" || !newsSourceForUrl(url.href)) return "";
    url.hostname=url.hostname.toLowerCase().replace(/^www\./,"");
    url.hash="";
    Array.from(url.searchParams.keys()).forEach(function(key){
      if(/^utm_/i.test(key) || ["fbclid","gclid","mc_cid","mc_eid","ref","source"].indexOf(key.toLowerCase())>=0) url.searchParams.delete(key);
    });
    url.pathname=url.pathname.replace(/\/+$/,"")||"/";
    return url.toString();
  }catch(e){ return ""; }
}
function decodeNewsText(value){
  return String(value||"")
    .replace(/<[^>]*>/g," ")
    .replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&nbsp;/gi," ")
    .replace(/\s+/g," ").trim();
}
function newsMetaValue(html, key){
  const escaped=String(key||"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const patterns=[
    new RegExp("<meta[^>]+(?:property|name)=[\"']"+escaped+"[\"'][^>]+content=[\"']([^\"']+)[\"'][^>]*>","i"),
    new RegExp("<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"']"+escaped+"[\"'][^>]*>","i")
  ];
  for(const pattern of patterns){
    const match=String(html||"").match(pattern);
    if(match) return decodeNewsText(match[1]);
  }
  return "";
}
function newsCanonicalFromHtml(html, fallback){
  const match=String(html||"").match(/<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i) ||
    String(html||"").match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["'][^>]*>/i);
  if(!match) return canonicalNewsUrl(fallback);
  try{ return canonicalNewsUrl(new URL(decodeNewsText(match[1]),fallback).toString())||canonicalNewsUrl(fallback); }
  catch(e){ return canonicalNewsUrl(fallback); }
}
async function fetchNewsMetadata(value){
  const sourceUrl=canonicalNewsUrl(value);
  if(!sourceUrl) return null;
  const controller=new AbortController();
  const timeout=setTimeout(function(){ controller.abort(); },8000);
  let response;
  try{ response=await fetch(sourceUrl,{headers:{Accept:"text/html,application/xhtml+xml"},signal:controller.signal}); }
  finally{ clearTimeout(timeout); }
  if(!response.ok) return null;
  const contentType=String(response.headers.get("Content-Type")||"");
  if(contentType.indexOf("text/html")<0) return null;
  const html=(await response.text()).slice(0,400000);
  const canonicalUrl=newsCanonicalFromHtml(html,sourceUrl);
  if(!canonicalUrl || !newsSourceForUrl(canonicalUrl)) return null;
  const title=newsMetaValue(html,"og:title") || decodeNewsText((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]);
  const description=newsMetaValue(html,"og:description") || newsMetaValue(html,"description");
  let imageUrl=newsMetaValue(html,"og:image");
  try{ if(imageUrl) imageUrl=new URL(imageUrl,canonicalUrl).toString(); }catch(e){ imageUrl=""; }
  if(imageUrl && !/^https:\/\//i.test(imageUrl)) imageUrl="";
  return {
    canonical_url:canonicalUrl,
    source_url:sourceUrl,
    source_name:newsSourceForUrl(canonicalUrl),
    title:title.slice(0,240),
    description:description.slice(0,700),
    image_url:imageUrl.slice(0,1000),
    published_at:(newsMetaValue(html,"article:published_time")||newsMetaValue(html,"datePublished")).slice(0,80)
  };
}
function newsIssueKey(date){
  return (date||new Date()).toISOString().slice(0,10);
}
function newsReleaseSlot(date){
  const current=new Date(date||Date.now());
  const weekday=current.getUTCDay();
  const daysBack=weekday===0 ? 3 : (weekday>=4 ? weekday-4 : weekday-1);
  current.setUTCHours(0,0,0,0);
  current.setUTCDate(current.getUTCDate()-daysBack);
  return newsIssueKey(current);
}
function publicNewsArticle(row){
  return {
    id:row.id,title:row.title,excerpt_pl:row.excerpt_pl,excerpt_en:row.excerpt_en,
    image_url:row.image_url||"",url:row.canonical_url,source_name:row.source_name,
    category:row.category||"whisky",published_at:row.article_published_at||row.created_at
  };
}
function safeRemoteNewsImage(value){
  try{
    const url=new URL(String(value||""));
    const host=url.hostname.toLowerCase();
    if(url.protocol!=="https:" || url.username || url.password) return "";
    if(host==="localhost" || host.endsWith(".local") || host==="[::1]" || /^\[(?:fc|fd|fe[89ab])/i.test(host)) return "";
    const ipv4=host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if(ipv4){
      const octets=ipv4.slice(1).map(Number);
      if(octets.some(function(part){ return part>255; })) return "";
      const first=octets[0], second=octets[1];
      if(first===0 || first===10 || first===127 || first>=224 || (first===100&&second>=64&&second<=127) || (first===169&&second===254) || (first===172&&second>=16&&second<=31) || (first===192&&second===168) || (first===198&&(second===18||second===19))) return "";
    }
    return url.toString();
  }catch(e){ return ""; }
}
async function fetchRemoteNewsImage(remoteUrl, canonicalUrl, signal){
  let current=remoteUrl;
  for(let redirectCount=0;redirectCount<4;redirectCount++){
    const response=await fetch(current,{
      redirect:"manual",
      signal:signal,
      headers:{Accept:"image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.8,*/*;q=0.2",Referer:canonicalUrl,"User-Agent":"Mozilla/5.0 Bourbon Hunters News Thumbnail"},
      cf:{cacheTtl:86400,cacheEverything:true}
    });
    if([301,302,303,307,308].indexOf(response.status)<0) return response;
    const location=response.headers.get("Location");
    current=safeRemoteNewsImage(location ? new URL(location,current).toString() : "");
    if(!current) return null;
  }
  return null;
}
async function newsImageResponse(env, articleId, cors){
  articleId=String(articleId||"").trim().slice(0,80);
  if(!articleId || !(await newsSchemaReady(env))) return J({error:"image_not_found"},404,cors);
  const row=await env.DB.prepare("SELECT id,canonical_url,image_url FROM news_articles WHERE id=? AND status='published'").bind(articleId).first();
  const remoteUrl=safeRemoteNewsImage(row&&row.image_url);
  if(!row || !remoteUrl) return J({error:"image_not_found"},404,cors);
  const imageKey="news/thumbnails/"+articleId;
  if(env.BOTTLE_IMAGES){
    const cached=await env.BOTTLE_IMAGES.get(imageKey);
    if(cached){
      const headers=new Headers(responseHeaders(cors));
      cached.writeHttpMetadata(headers);
      headers.set("Content-Type",headers.get("Content-Type")||"image/jpeg");
      headers.set("Cache-Control","public, max-age=604800, stale-while-revalidate=86400");
      return new Response(cached.body,{headers:headers});
    }
  }
  const controller=new AbortController();
  const timeout=setTimeout(function(){ controller.abort(); },10000);
  let response;
  try{
    response=await fetchRemoteNewsImage(remoteUrl,row.canonical_url,controller.signal);
  }catch(e){ return J({error:"image_unavailable"},404,cors); }
  finally{ clearTimeout(timeout); }
  if(!response || !response.ok) return J({error:"image_unavailable"},404,cors);
  const contentType=String(response.headers.get("Content-Type")||"").split(";")[0].trim().toLowerCase();
  if(["image/jpeg","image/png","image/webp","image/gif","image/avif"].indexOf(contentType)<0) return J({error:"invalid_image_type"},415,cors);
  const contentLength=Number(response.headers.get("Content-Length")||0);
  if(contentLength>4000000) return J({error:"image_too_large"},413,cors);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(!bytes.byteLength || bytes.byteLength>4000000) return J({error:"image_too_large"},413,cors);
  if(env.BOTTLE_IMAGES){
    await env.BOTTLE_IMAGES.put(imageKey,bytes,{httpMetadata:{contentType:contentType,cacheControl:"public, max-age=604800"}}).catch(function(){});
  }
  return new Response(bytes,{headers:responseHeaders(Object.assign({},cors,{"Content-Type":contentType,"Cache-Control":"public, max-age=604800, stale-while-revalidate=86400"}))});
}
async function seedStarterNews(env){
  if(!(await newsSchemaReady(env))) return {seeded:0,ready:false};
  const issueKey="starter-news-v1";
  const marker=await env.DB.prepare("SELECT id FROM news_agent_runs WHERE issue_key=? AND status='completed' LIMIT 1").bind(issueKey).first();
  if(marker) return {seeded:0,ready:true,already_seeded:true};
  const articleIssueKey="starter-news-v1";
  const metadata=await Promise.all(STARTER_NEWS.map(function(article){
    return fetchNewsMetadata(article.url).catch(function(){ return null; });
  }));
  const now=new Date().toISOString();
  let seeded=0;
  for(let index=0;index<STARTER_NEWS.length;index++){
    const article=STARTER_NEWS[index];
    const meta=metadata[index];
    const canonicalUrl=(meta&&meta.canonical_url)||canonicalNewsUrl(article.url);
    if(!canonicalUrl) continue;
    const result=await env.DB.prepare("INSERT OR IGNORE INTO news_articles (id,canonical_url,source_url,source_name,title,excerpt_pl,excerpt_en,image_url,category,article_published_at,issue_key,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(),canonicalUrl,(meta&&meta.source_url)||canonicalUrl,(meta&&meta.source_name)||newsSourceForUrl(canonicalUrl),(meta&&meta.title)||article.title,article.excerpt_pl,article.excerpt_en,(meta&&meta.image_url)||null,article.category,article.published_at,articleIssueKey,"published",now,now).run();
    seeded+=Number(result.meta&&result.meta.changes||0);
  }
  await env.DB.prepare("INSERT INTO news_agent_runs (id,issue_key,status,candidates_found,articles_added,detail,started_at,completed_at) VALUES (?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),issueKey,"completed",STARTER_NEWS.length,seeded,"one-time starter feed",now,new Date().toISOString()).run();
  return {seeded:seeded,ready:true};
}
async function cleanupNews(env){
  if(!(await newsSchemaReady(env))) return {deleted:0};
  const cutoff=new Date(Date.now()-NEWS_RETENTION_DAYS*86400000).toISOString();
  await env.DB.prepare("DELETE FROM news_articles WHERE source_name='Distiller' OR canonical_url LIKE 'https://distiller.com/%' OR canonical_url LIKE 'https://www.distiller.com/%'").run();
  const result=await env.DB.prepare("DELETE FROM news_articles WHERE created_at<?").bind(cutoff).run();
  await env.DB.prepare("DELETE FROM news_agent_runs WHERE started_at<? AND issue_key<>?").bind(new Date(Date.now()-180*86400000).toISOString(),"starter-news-v1").run();
  return {deleted:Number(result.meta&&result.meta.changes||0),cutoff:cutoff};
}
async function newsFeed(env, limit){
  if(!(await newsSchemaReady(env))) return {articles:[],news_ready:false};
  const rows=await env.DB.prepare("SELECT * FROM news_articles WHERE status='published' AND source_name IN ('Whisky Advocate','Whisky Magazine','The Whiskey Wash','Breaking Bourbon') ORDER BY COALESCE(article_published_at,created_at) DESC,created_at DESC LIMIT ?")
    .bind(Math.max(1,Math.min(30,Number(limit)||12))).all();
  return {articles:(rows.results||[]).map(publicNewsArticle),news_ready:true,agent_version:NEWS_AGENT_VERSION};
}
function newsLinkLooksEditorial(value){
  const canonical=canonicalNewsUrl(value);
  if(!canonical) return false;
  const url=new URL(canonical);
  const path=url.pathname.toLowerCase();
  if(path==="/" || /\.(?:jpg|jpeg|png|webp|gif|svg|pdf)$/i.test(path)) return false;
  if(/\/(?:about|contact|advertise|privacy|terms|subscribe|newsletter|search|tag|category)(?:\/|$)/i.test(path)) return false;
  const host=url.hostname;
  if(host==="whiskymag.com") return /^\/articles\/[^/]+/.test(path);
  if(host==="thewhiskeywash.com") return path.indexOf("/category/")!==0 && path.split("/").filter(Boolean).length>=1;
  if(host==="breakingbourbon.com") return /^\/(?:article|news)\//.test(path);
  return path.split("/").filter(Boolean).length>=1;
}
function newsLinksFromIndex(html, baseUrl){
  const found=[];
  const seen={};
  const add=function(raw){
    let absolute="";
    try{ absolute=new URL(decodeNewsText(raw),baseUrl).toString(); }catch(e){ return; }
    const canonical=canonicalNewsUrl(absolute);
    if(!canonical || seen[canonical] || !newsLinkLooksEditorial(canonical)) return;
    seen[canonical]=true; found.push(canonical);
  };
  const source=String(html||"");
  let match;
  const anchor=/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  while((match=anchor.exec(source)) && found.length<30) add(match[1]);
  const xmlLink=/<link\b[^>]*>([^<]+)<\/link>/gi;
  while((match=xmlLink.exec(source)) && found.length<30) add(match[1]);
  return found;
}
async function fetchNewsDiscoveryPage(value){
  const controller=new AbortController();
  const timeout=setTimeout(function(){ controller.abort(); },8000);
  try{
    const response=await fetch(value,{headers:{Accept:"text/html,application/xhtml+xml,application/rss+xml,application/xml"},signal:controller.signal});
    if(!response.ok) return [];
    return newsLinksFromIndex((await response.text()).slice(0,700000),value);
  }catch(e){ return []; }
  finally{ clearTimeout(timeout); }
}
async function discoverNewsMetadata(priorUrls){
  const prior={};
  (priorUrls||[]).forEach(function(url){ const canonical=canonicalNewsUrl(url); if(canonical) prior[canonical]=true; });
  const pages=await Promise.all(NEWS_DISCOVERY_PAGES.map(fetchNewsDiscoveryPage));
  const links=[];
  const seen={};
  pages.forEach(function(items){
    (items||[]).forEach(function(url){ if(!prior[url] && !seen[url] && links.length<32){ seen[url]=true; links.push(url); } });
  });
  const metadata=await Promise.all(links.map(function(url){ return fetchNewsMetadata(url).catch(function(){ return null; }); }));
  return metadata.filter(function(item){ return !!(item&&item.title&&item.canonical_url); }).sort(function(a,b){
    return Date.parse(b.published_at||0)-Date.parse(a.published_at||0);
  });
}
function newsCategoryFromMetadata(item){
  const text=norm((item&&item.title||"")+" "+(item&&item.description||""));
  if(/bourbon|kentucky|american whiskey|tennessee/.test(text)) return "bourbon";
  if(/scotch|scotland|speyside|islay|highland/.test(text)) return "scotch";
  if(/irish|ireland/.test(text)) return "irish";
  if(/japan|japanese/.test(text)) return "japanese";
  if(/industry|tariff|market|sales|merger|acquisition/.test(text)) return "industry";
  return "world";
}
function newsFallbackExcerpt(item, langCode){
  const title=decodeNewsText(item&&item.title||"").slice(0,220);
  const description=decodeNewsText(item&&item.description||"").slice(0,360);
  if(langCode==="pl") return ("Nowy material redakcji "+String(item&&item.source_name||"whisky")+": "+title+". Pelny kontekst i szczegoly znajduja sie w artykule zrodlowym.").slice(0,520);
  return (description || ("A new article from "+String(item&&item.source_name||"a whisky publication")+" about "+title+".")).slice(0,520);
}
async function summarizeNewsCandidates(env, candidates){
  if(!env.GEMINI_API_KEY || !candidates.length) return {ok:false,error:"gemini_unavailable",items:[]};
  const compact=candidates.slice(0,12).map(function(item){
    return {url:item.canonical_url,source:item.source_name,title:item.title,description:item.description,published_at:item.published_at};
  });
  const prompt=[
    "Select the 3 most useful and recent whisky articles from this verified editorial list.",
    "Do not add URLs and do not invent facts. Return concise factual summaries in Polish and English.",
    "Return ONLY JSON: {\"articles\":[{\"url\":\"\",\"excerpt_pl\":\"\",\"excerpt_en\":\"\",\"category\":\"bourbon|scotch|irish|japanese|world|industry\"}]}",
    JSON.stringify(compact)
  ].join("\n");
  const result=await callGemini(env,{__model:env.NEWS_MODEL||"gemini-3.6-flash",contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:0.15,maxOutputTokens:2200}},"whisky_news");
  if(result.usage) await recordServiceUsage(env,null,null,result.usage).catch(function(){});
  if(result.err) return {ok:false,error:"news_agent_"+String(result.err.status||"upstream"),items:[]};
  const parsed=parseJson(result.txt)||{};
  const items=Array.isArray(parsed.articles)?parsed.articles:[];
  return {ok:items.length>0,error:items.length?null:"news_agent_empty",items:items};
}
async function refreshWhiskyNews(env, reason, scheduledAt){
  if(!(await newsSchemaReady(env))) return {ok:false,error:"news_schema_missing"};
  const issueKey=newsReleaseSlot(new Date(scheduledAt||Date.now()));
  const existing=await env.DB.prepare("SELECT COUNT(*) AS count FROM news_articles WHERE issue_key=? AND status='published'").bind(issueKey).first();
  const existingCount=Number(existing&&existing.count)||0;
  if(existingCount>=3) return {ok:true,status:"skipped",reason:"issue_complete",issue_key:issueKey,added:0};
  const recentRun=await env.DB.prepare("SELECT status,started_at FROM news_agent_runs WHERE issue_key=? ORDER BY started_at DESC LIMIT 1").bind(issueKey).first();
  if(recentRun && recentRun.status==="running" && Date.now()-Date.parse(recentRun.started_at)<30*60*1000){
    return {ok:true,status:"skipped",reason:"already_running",issue_key:issueKey,added:0};
  }
  const runId=crypto.randomUUID();
  const startedAt=new Date().toISOString();
  await env.DB.prepare("INSERT INTO news_agent_runs (id,issue_key,status,candidates_found,articles_added,detail,started_at) VALUES (?,?,?,?,?,?,?)")
    .bind(runId,issueKey,"running",0,0,String(reason||"scheduled").slice(0,80),startedAt).run();
  try{
    const priorRows=await env.DB.prepare("SELECT canonical_url FROM news_articles WHERE status='published' ORDER BY created_at DESC LIMIT 120").all();
    const priorUrls=(priorRows.results||[]).map(function(row){ return row.canonical_url; }).filter(Boolean);
    const candidates=await discoverNewsMetadata(priorUrls);
    if(!candidates.length) throw new Error("source_discovery_empty");
    const ai=await summarizeNewsCandidates(env,candidates);
    const byUrl={};
    candidates.forEach(function(item){ byUrl[item.canonical_url]=item; });
    const selected=[];
    const selectedUrls={};
    (ai.items||[]).forEach(function(item){
      const url=canonicalNewsUrl(item&&item.url);
      if(url && byUrl[url] && !selectedUrls[url]){
        selectedUrls[url]=true;
        selected.push({metadata:byUrl[url],summary:item});
      }
    });
    candidates.forEach(function(item){
      if(!selectedUrls[item.canonical_url]){
        selectedUrls[item.canonical_url]=true;
        selected.push({metadata:item,summary:null});
      }
    });
    let added=0, duplicates=0;
    const target=Math.max(0,3-existingCount);
    for(const candidate of selected){
      if(added>=target) break;
      const metadata=candidate.metadata;
      const duplicate=await env.DB.prepare("SELECT id FROM news_articles WHERE canonical_url=?").bind(metadata.canonical_url).first();
      if(duplicate){ duplicates++; continue; }
      const summary=candidate.summary||{};
      const excerptPl=decodeNewsText(summary.excerpt_pl||newsFallbackExcerpt(metadata,"pl")).slice(0,520);
      const excerptEn=decodeNewsText(summary.excerpt_en||newsFallbackExcerpt(metadata,"en")).slice(0,520);
      const category=String(summary.category||newsCategoryFromMetadata(metadata)).slice(0,40);
      const now=new Date().toISOString();
      await env.DB.prepare("INSERT INTO news_articles (id,canonical_url,source_url,source_name,title,excerpt_pl,excerpt_en,image_url,category,article_published_at,issue_key,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(),metadata.canonical_url,metadata.source_url,metadata.source_name,metadata.title,excerptPl,excerptEn,metadata.image_url||null,category,metadata.published_at||null,issueKey,"published",now,now).run();
      added++;
    }
    const completedAt=new Date().toISOString();
    const status=added>0?"completed":"failed";
    const detail=JSON.stringify({discovery:"editorial_sources",ai:ai.ok?"summarized":ai.error,fallback_used:!ai.ok,candidates:candidates.length,duplicates:duplicates});
    await env.DB.prepare("UPDATE news_agent_runs SET status=?,candidates_found=?,articles_added=?,detail=?,completed_at=? WHERE id=?")
      .bind(status,candidates.length,added,detail,completedAt,runId).run();
    return {ok:added>0,status:status,issue_key:issueKey,candidates:candidates.length,added:added,ai_fallback:!ai.ok,error:added?null:"no_new_articles"};
  }catch(e){
    const completedAt=new Date().toISOString();
    const detail=String(e&&e.message?e.message:e).slice(0,300);
    await env.DB.prepare("UPDATE news_agent_runs SET status='failed',detail=?,completed_at=? WHERE id=?").bind(detail,completedAt,runId).run().catch(function(){});
    return {ok:false,status:"failed",issue_key:issueKey,error:detail};
  }
}
async function createLocalBottleCutout(env, request, body){
  if(!env.IMAGES) return {error:"image_pipeline_unavailable",status:501};
  const image=String(body&&body.image||"");
  const mime=["image/jpeg","image/png","image/webp"].includes(body&&body.mime)?body.mime:"image/jpeg";
  if(!image || image.length<100 || image.length>8000000) return {error:"bad_image",status:400};
  const user=await authUser(env,request);
  const deviceHash=await telemetryDeviceHash(body&&body.device_id);
  const budget=await consumeScannerBudget(env,request,user,deviceHash,"cutout");
  if(!budget.allowed) return {error:budget.error||"local_cutout_limit",limit:budget.limit||0,remaining:budget.remaining||0,reason:budget.reason||null,status:budget.error?503:429};
  const started=Date.now();
  try{
    const processed=await transformBottleCutout(env,mime,image);
    if(!processed) throw new Error("image_pipeline_unavailable");
    const quality=await assessBottleCutout(env,String(body&&body.bottle_name||body&&body.bottle_id||""),processed);
    if(quality.usage) await recordServiceUsage(env,null,user&&user.id,quality.usage).catch(function(){});
    if(!quality.acceptable){
      await recordServiceUsage(env,null,user&&user.id,{provider:"cloudflare",stage:"local_image_cutout",model:"cloudflare-images",status:422,attempts:1,duration_ms:Date.now()-started}).catch(function(){});
      return {error:"cutout_quality",reason_code:quality.reason_code,retry:true,status:422,pipeline_version:LOCAL_IMAGE_PIPELINE_VERSION};
    }
    await recordServiceUsage(env,null,user&&user.id,{provider:"cloudflare",stage:"local_image_cutout",model:"cloudflare-images",status:200,attempts:1,duration_ms:Date.now()-started}).catch(function(){});
    return {ok:true,image:"data:image/webp;base64,"+encodeBase64(processed),mime:"image/webp",width:960,height:1280,quality_checked:quality.checked,pipeline_version:LOCAL_IMAGE_PIPELINE_VERSION};
  }catch(e){
    await recordServiceUsage(env,null,user&&user.id,{provider:"cloudflare",stage:"local_image_cutout",model:"cloudflare-images",status:500,attempts:1,duration_ms:Date.now()-started}).catch(function(){});
    return {error:"image_cutout_failed",retry:true,status:502};
  }
}
async function handleApi(request, env, cors){
  const url=new URL(request.url);
  const path=url.pathname.replace(/\/+$/,"");
  if(path==="/auth/health" && request.method==="GET"){
    return J({ok:true,worker:"bourbon-hunters",auth_version:AUTH_VERSION,security_version:SECURITY_VERSION,auth_protection_version:AUTH_PROTECTION_VERSION,time:new Date().toISOString()},200,cors);
  }
  if(path==="/admin/health" && request.method==="GET"){
    const healthUser=await authUser(env,request);
    if(!isAdminUser(env,healthUser)) return J({error:"forbidden"},403,cors);
    let schema=false, reset_schema=false, profile_schema=false, recommendations_schema=false, identity_schema=false, auth_security_schema=false, auth_rate_schema=false, catalog_schema=false, catalog_data_schema=false, catalog_moderation_schema=false, telemetry_schema=false, scanner_budget_schema=false, news_schema=false, private_bottle_schema=false, ugc_moderation_schema=false, news_article_count=0, news_last_run=null, detail="";
    if(env.DB){
      try{
        await env.DB.prepare("SELECT id FROM users LIMIT 1").first();
        const cols=await userColumns(env);
        schema=!!(cols.id && cols.email && cols.username && cols.birth_date && cols.age_verified_at);
        if(!schema) detail="users table exists, but age-gate columns are missing";
        reset_schema=await tableExists(env,"password_reset_tokens");
        if(schema && !reset_schema) detail="password_reset_tokens table is missing";
        profile_schema=await tableExists(env,"user_profiles");
        if(schema && reset_schema && !profile_schema) detail="user_profiles table is missing";
        recommendations_schema=await tableExists(env,"bottle_recommendations");
        if(schema && reset_schema && profile_schema && !recommendations_schema) detail="bottle_recommendations table is missing";
        identity_schema=await tableExists(env,"auth_identities");
        if(schema && reset_schema && profile_schema && recommendations_schema && !identity_schema) detail="auth_identities table is missing";
        auth_security_schema=await authSecuritySchemaReady(env);
        if(schema && identity_schema && !auth_security_schema) detail="auth hardening migration v69 is missing";
        auth_rate_schema=await authRateSchemaReady(env);
        if(schema && auth_security_schema && !auth_rate_schema) detail="auth rate migration v71 is missing";
        catalog_schema=(await tableExists(env,"bottle_submissions")) && (await tableExists(env,"catalog_bottles"));
        if(schema && reset_schema && profile_schema && recommendations_schema && identity_schema && !catalog_schema) detail="catalog submission tables are missing";
        catalog_data_schema=catalog_schema && await catalogDataSchemaReady(env);
        if(schema && reset_schema && profile_schema && recommendations_schema && identity_schema && catalog_schema && !catalog_data_schema) detail="catalog data lifecycle migration v65 is missing";
        catalog_moderation_schema=catalog_data_schema && await catalogModerationSchemaReady(env);
        if(schema && catalog_data_schema && !catalog_moderation_schema) detail="catalog moderation migration v67 is missing";
        telemetry_schema=await telemetrySchemaReady(env);
        if(schema && catalog_data_schema && catalog_moderation_schema && !telemetry_schema) detail="telemetry migration v66 is missing";
        scanner_budget_schema=await scannerBudgetSchemaReady(env);
        if(schema && telemetry_schema && !scanner_budget_schema) detail="scanner budget migration v70 is missing";
        news_schema=await newsSchemaReady(env);
        if(schema && telemetry_schema && !news_schema) detail="whisky news migration v68 is missing";
        private_bottle_schema=await privateBottleSchemaReady(env);
        if(schema && !private_bottle_schema) detail="private bottle migration v72 is missing";
        ugc_moderation_schema=await ugcModerationSchemaReady(env);
        if(schema && !ugc_moderation_schema) detail="comment moderation migration v74 is missing";
        if(news_schema){
          const newsCount=await env.DB.prepare("SELECT COUNT(*) AS count FROM news_articles WHERE status='published'").first();
          const lastNewsRun=await env.DB.prepare("SELECT issue_key,status,candidates_found,articles_added,detail,started_at,completed_at FROM news_agent_runs ORDER BY started_at DESC LIMIT 1").first();
          news_article_count=Number(newsCount&&newsCount.count)||0;
          news_last_run=lastNewsRun||null;
        }
      }
      catch(e){ detail=String(e&&e.message?e.message:e).slice(0,220); }
    }
    return J({ok:true,worker:"bourbon-hunters",auth_version:AUTH_VERSION,security_version:SECURITY_VERSION,auth_protection_version:AUTH_PROTECTION_VERSION,private_bottle_version:PRIVATE_BOTTLE_VERSION,ugc_moderation_version:UGC_MODERATION_VERSION,scan_orchestrator_version:SCAN_ORCHESTRATOR_VERSION,scan_mode:"visual_only",scan_ocr_enabled:false,scanner_ai_ready:!!env.GEMINI_API_KEY,scanner_primary_model:env.IDENT_MODEL||"gemini-3.5-flash-lite",scanner_fallback_model:env.IDENT_FALLBACK_MODEL||"gemini-3.6-flash",scanner_model_discovery:true,scanner_mobile_foreground:!!env.IMAGES,scanner_budget_version:SCANNER_BUDGET_VERSION,scanner_budget_schema:scanner_budget_schema,scanner_identify_daily_limit:scannerBudgetLimits(env,"identify").actor,scanner_cutout_daily_limit:scannerBudgetLimits(env,"cutout").actor,scanner_analysis_daily_limit:scannerBudgetLimits(env,"analysis").actor,scan_catalog_version:SCAN_CATALOG_VERSION,catalog_submission_version:CATALOG_SUBMISSION_VERSION,catalog_moderation_version:CATALOG_MODERATION_VERSION,catalog_license_version:CATALOG_LICENSE_VERSION,telemetry_version:TELEMETRY_VERSION,news_agent_version:NEWS_AGENT_VERSION,news_schedule:"Monday and Thursday releases with daily recovery via UTC cron",news_target_per_release:3,news_current_release:newsReleaseSlot(new Date()),news_article_count:news_article_count,news_last_run:news_last_run,local_image_pipeline_version:LOCAL_IMAGE_PIPELINE_VERSION,news_retention_days:NEWS_RETENTION_DAYS,starter_news_count:STARTER_NEWS.length,news_auth_required:true,catalog_draft_retention_hours:24,telemetry_retention_days:telemetryRetentionDays(env),pbkdf2_iterations:PBKDF2_ITERATIONS,d1:!!env.DB,schema:schema,reset_schema:reset_schema,profile_schema:profile_schema,recommendations_schema:recommendations_schema,identity_schema:identity_schema,auth_security_schema:auth_security_schema,auth_rate_schema:auth_rate_schema,catalog_schema:catalog_schema,catalog_data_schema:catalog_data_schema,catalog_moderation_schema:catalog_moderation_schema,telemetry_schema:telemetry_schema,news_schema:news_schema,private_bottle_schema:private_bottle_schema,ugc_moderation_schema:ugc_moderation_schema,news_agent_ready:news_schema,operational_telemetry_ready:telemetry_schema&&operationalTelemetryEnabled(env),image_pipeline_ready:!!(env.IMAGES&&env.BOTTLE_IMAGES),local_image_cutout_ready:!!env.IMAGES,cutout_quality_ready:!!(env.IMAGES&&env.GEMINI_API_KEY),email_ready:mailConfigured(env),google_ready:googleReady(env),google_redirect_uri:env.GOOGLE_REDIRECT_URI?googleRedirectUri(env,request):"",detail:detail,time:new Date().toISOString()},200,cors);
  }
  if(path==="/auth/google/start" && request.method==="GET"){
    const returnUrl=allowedReturnUrl(env,url.searchParams.get("return")||appUrl(env));
    if(!googleReady(env)) return redirectWithHash(returnUrl,{google_error:"google_not_configured"});
    const state=await makeGoogleState(env,{return_url:returnUrl,iat:Date.now(),nonce:randHex(8)});
    return Response.redirect(googleAuthorizationUrl(request,env,state),302);
  }
  if(path==="/auth/google/callback" && request.method==="GET"){
    const fallback=appUrl(env);
    const state=await readGoogleState(env,url.searchParams.get("state")||"");
    const returnUrl=allowedReturnUrl(env,state&&state.return_url || fallback);
    if(url.searchParams.get("error")) return redirectWithHash(returnUrl,{google_error:url.searchParams.get("error")});
    if(!state) return redirectWithHash(returnUrl,{google_error:"bad_state"});
    if(!googleReady(env)) return redirectWithHash(returnUrl,{google_error:"google_not_configured"});
    if(!env.DB) return redirectWithHash(returnUrl,{google_error:"d1_missing"});
    try{
      const googleUser=await googleExchange(request,env,String(url.searchParams.get("code")||""));
      if(state.mode==="link"){
        await completeGoogleLink(env,state,googleUser);
        return redirectWithHash(returnUrl,{google_link:"ok"});
      }
      const data=await googleUserLogin(env,request,googleUser);
      return redirectWithHash(returnUrl,{google_token:data.token,google_login:"ok",google_new:data.created?1:0});
    }catch(e){
      return redirectWithHash(returnUrl,{google_error:String((e&&e.error)||"google_failed").slice(0,80)});
    }
  }
  const dbErr=needDB(env,cors); if(dbErr) return dbErr;
  const newsImageMatch=path.match(/^\/news\/image\/([^/]+)$/);
  if(newsImageMatch && request.method==="GET") return newsImageResponse(env,decodeURIComponent(newsImageMatch[1]),cors);
  if(path==="/news" && request.method==="GET"){
    const newsUser=await authUser(env,request);
    if(!newsUser) return J({error:"unauthorized"},401,cors);
    await seedStarterNews(env);
    const feed=await newsFeed(env,url.searchParams.get("limit"));
    return J(feed,200,cors);
  }
  if(path==="/catalog/local-cutout" && request.method==="POST"){
    const result=await createLocalBottleCutout(env,request,await readBody(request));
    return J(result,result.status||200,cors);
  }
  if(path==="/catalog/recent" && request.method==="GET"){
    if(!(await tableExists(env,"catalog_bottles"))) return J({bottles:[],catalog_ready:false},200,cors);
    const limit=Math.max(1,Math.min(50,Number(url.searchParams.get("limit")||24)));
    const rows=await env.DB.prepare("SELECT * FROM catalog_bottles WHERE status='published' ORDER BY created_at DESC LIMIT ?").bind(limit).all();
    return J({bottles:(rows.results||[]).map(function(row){ return publicCatalogBottle(row,request); }).filter(catalogBottleVisible),catalog_ready:true},200,cors);
  }
  if(path.indexOf("/catalog/image/")===0 && request.method==="GET"){
    if(!(await tableExists(env,"catalog_bottles")) || !env.BOTTLE_IMAGES) return J({error:"image_not_found"},404,cors);
    const bottleId=decodeURIComponent(path.slice("/catalog/image/".length));
    const row=await env.DB.prepare("SELECT cb.image_key,bs.processed_key FROM catalog_bottles cb LEFT JOIN bottle_submissions bs ON bs.id=cb.image_submission_id WHERE cb.bottle_id=? AND cb.status='published'").bind(bottleId).first();
    const imageKey=row && (row.image_key||row.processed_key);
    if(!imageKey) return J({error:"image_not_found"},404,cors);
    const object=await env.BOTTLE_IMAGES.get(imageKey);
    if(!object) return J({error:"image_not_found"},404,cors);
    const headers=new Headers(responseHeaders(cors));
    object.writeHttpMetadata(headers);
    headers.set("Content-Type",headers.get("Content-Type")||"image/webp");
    headers.set("Cache-Control","public, max-age=86400");
    if(object.httpEtag) headers.set("ETag",object.httpEtag);
    return new Response(object.body,{headers:headers});
  }
  if(path==="/ratings" && request.method==="GET"){
    const ids=cleanBottleIds(url.searchParams.get("ids")||"");
    return J({ratings:await ratingAggregatesFor(env,ids)},200,Object.assign({},cors,{"Cache-Control":"public, max-age=30, stale-while-revalidate=60"}));
  }
  if(path==="/recommendations" && request.method==="GET"){
    const bottleId=String(url.searchParams.get("bottle_id")||"").trim();
    const recommendationViewer=await authUser(env,request);
    const data=await recommendationsFor(env,bottleId,Number(url.searchParams.get("limit")||40),recommendationViewer&&recommendationViewer.id);
    return J({recommendations:data.recommendations,recommendations_ready:data.ready},200,cors);
  }
  if(path==="/telemetry/scan-choice" && request.method==="POST"){
    if(!(await telemetrySchemaReady(env))) return J({error:"telemetry_schema_missing"},501,cors);
    const body=await readBody(request);
    const scanId=String(body.scan_id||"").trim();
    const choice=String(body.choice||"");
    const selectedId=String(body.selected_bottle_id||"").trim().slice(0,180);
    if(!/^[a-f0-9-]{20,40}$/i.test(scanId) || ["confirmed","cancelled"].indexOf(choice)<0) return J({error:"bad_choice"},400,cors);
    const row=await env.DB.prepare("SELECT * FROM scanner_runs WHERE id=?").bind(scanId).first();
    if(!row) return J({error:"scan_not_found"},404,cors);
    const choiceUser=await authUser(env,request);
    const deviceHash=await telemetryDeviceHash(body.device_id);
    if(row.user_id ? (!choiceUser || choiceUser.id!==row.user_id) : (!row.device_hash || row.device_hash!==deviceHash)) return J({error:"forbidden"},403,cors);
    if(row.outcome!=="candidates_presented" || row.confirmed_at) return J({ok:true,already_recorded:true},200,cors);
    if(choice==="cancelled"){
      await env.DB.prepare("UPDATE scanner_runs SET outcome='cancelled' WHERE id=?").bind(scanId).run();
      return J({ok:true,outcome:"cancelled"},200,cors);
    }
    const candidates=safeJson(row.candidate_ids_json,[]);
    if(!selectedId || !candidates.some(function(item){ return item&&item.id===selectedId; })) return J({error:"candidate_not_offered"},400,cors);
    const outcome=selectedId===row.suggested_bottle_id ? "confirmed_top" : "confirmed_alternate";
    const now=new Date().toISOString();
    await env.DB.prepare("UPDATE scanner_runs SET outcome=?,confirmed_bottle_id=?,matched_bottle_id=?,confirmed_at=? WHERE id=?")
      .bind(outcome,selectedId,selectedId,now,scanId).run();
    return J({ok:true,outcome:outcome},200,cors);
  }
  if(path==="/auth/register" && request.method==="POST"){
    const parsedBody=await readLimitedJson(request,AUTH_BODY_MAX_BYTES);
    if(!parsedBody.ok) return J({error:parsedBody.error},parsedBody.status,cors);
    const body=parsedBody.body;
    const email=cleanEmail(body.email);
    const username=cleanUsername(body.username);
    const password=String(body.password||"");
    const birthDate=cleanBirthDate(body.birth_date||body.birthDate);
    const minAge=ageGateMin(env);
    const ageCountry=String(body.age_gate_country||body.country||"global").trim().slice(0,24)||"global";
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return J({error:"bad_email"},400,cors);
    if(!/^[a-zA-Z0-9_.-]{2,40}$/.test(username)) return J({error:"bad_username"},400,cors);
    const rate=await consumeAuthRate(env,request,"register",email||username||"invalid");
    if(!rate.allowed) return authRateResponse(rate,cors);
    if(password.length<8 || password.length>128) return J({error:"weak_password"},400,cors);
    if(!birthDate) return J({error:"age_required",min_age:minAge},400,cors);
    if(!isOldEnough(birthDate,minAge)) return J({error:"age_restricted",min_age:minAge},403,cors);
    if(!(await authSecuritySchemaReady(env))) return J({error:"schema_auth_security_missing",message:"Run D1 migration v69 before enabling registration."},501,cors);
    if(!mailConfigured(env)) return J({error:"registration_email_unavailable"},503,cors);
    const emailExists=await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
    if(emailExists) return J({error:"registration_unavailable"},409,cors);
    const usernameExists=await env.DB.prepare("SELECT id FROM users WHERE username=?").bind(username).first();
    if(usernameExists) return J({error:"registration_unavailable"},409,cors);
    const cols=await userColumns(env);
    if(!cols.birth_date || !cols.age_verified_at) return J({error:"schema_age_missing",message:"Run the latest D1 migration for age-gate columns."},501,cors);
    const salt=randHex(16);
    const hash=await hashPassword(password,salt);
    const now=new Date().toISOString();
    const id=crypto.randomUUID();
    await env.DB.prepare("INSERT INTO users (id,email,username,password_hash,password_salt,password_algo,birth_date,age_gate_country,age_gate_min,age_verified_at,email_verified_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,email,username,hash,salt,"pbkdf2-sha256-"+PBKDF2_ITERATIONS,birthDate,ageCountry,minAge,now,null,now,now).run();
    const mail=await createEmailVerification(env,request,{id:id,email:email,username:username}).catch(function(){ return {sent:false}; });
    if(!mail.sent){
      await env.DB.prepare("DELETE FROM users WHERE id=?").bind(id).run();
      return J({error:"verification_delivery_failed"},503,cors);
    }
    return J({ok:true,verification_required:true,email_ready:!!mail.sent},202,cors);
  }
  if(path==="/auth/email-verification/resend" && request.method==="POST"){
    if(!(await authSecuritySchemaReady(env))) return J({error:"schema_auth_security_missing"},501,cors);
    const parsedBody=await readLimitedJson(request,AUTH_BODY_MAX_BYTES);
    if(!parsedBody.ok) return J({error:parsedBody.error},parsedBody.status,cors);
    const body=parsedBody.body;
    const email=cleanEmail(body.email);
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return J({error:"bad_email"},400,cors);
    const rate=await consumeAuthRate(env,request,"verification_resend",email);
    if(!rate.allowed) return authRateResponse(rate,cors);
    const row=await env.DB.prepare("SELECT id,email,username,email_verified_at FROM users WHERE email=?").bind(email).first();
    let sent=false;
    if(row && !row.email_verified_at && mailConfigured(env)){
      const mail=await createEmailVerification(env,request,row).catch(function(){ return {sent:false}; });
      sent=!!mail.sent;
    }
    return J({ok:true,email_ready:mailConfigured(env)},200,cors);
  }
  if(path==="/auth/email-verification/confirm" && request.method==="POST"){
    if(!(await authSecuritySchemaReady(env))) return J({error:"schema_auth_security_missing"},501,cors);
    const parsedBody=await readLimitedJson(request,AUTH_BODY_MAX_BYTES);
    if(!parsedBody.ok) return J({error:parsedBody.error},parsedBody.status,cors);
    const body=parsedBody.body;
    const token=String(body.token||"").trim();
    if(!/^[a-f0-9]{64}$/i.test(token)) return J({error:"verification_token_invalid"},400,cors);
    const rate=await consumeAuthRate(env,request,"email_confirm",token.slice(0,16));
    if(!rate.allowed) return authRateResponse(rate,cors);
    const tokenHash=await sha256Hex(token);
    const now=new Date().toISOString();
    let row=await env.DB.prepare("SELECT evt.id AS verification_id,u.* FROM email_verification_tokens evt JOIN users u ON u.id=evt.user_id WHERE evt.token_hash=? AND evt.expires_at>? AND evt.used_at IS NULL")
      .bind(tokenHash,now).first();
    if(!row) return J({error:"verification_token_invalid"},400,cors);
    await env.DB.prepare("UPDATE users SET email_verified_at=?,updated_at=? WHERE id=?").bind(now,now,row.id).run();
    await env.DB.prepare("UPDATE email_verification_tokens SET used_at=? WHERE id=?").bind(now,row.verification_id).run();
    row.email_verified_at=now;
    await attachRoleFlags(env,row);
    const sessionToken=await createSession(env,request,row.id);
    sendWelcomeEmail(env,row).catch(function(){});
    return J({token:sessionToken,user:publicUser(row),bootstrap:await bootstrapFor(env,row.id),profile:await profileFor(env,row.id),admin:isAdminUser(env,row)},200,cors);
  }
  if(path==="/auth/password-reset" && request.method==="POST"){
    const parsedBody=await readLimitedJson(request,AUTH_BODY_MAX_BYTES);
    if(!parsedBody.ok) return J({error:parsedBody.error},parsedBody.status,cors);
    const body=parsedBody.body;
    const email=cleanEmail(body.email);
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return J({error:"bad_email"},400,cors);
    const rate=await consumeAuthRate(env,request,"password_reset",email);
    if(!rate.allowed) return authRateResponse(rate,cors);
    if(!(await tableExists(env,"password_reset_tokens"))) return J({ok:true,email_ready:false,reset_ready:false,message:"Password reset migration is not applied yet."},200,cors);
    const row=await env.DB.prepare("SELECT id,email,username FROM users WHERE email=?").bind(email).first();
    let sent=false;
    if(row){
      const now=new Date();
      const expires=new Date(now.getTime()+1000*60*60);
      const rawToken=randHex(32);
      const tokenHash=await sha256Hex(rawToken);
      await env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id=? OR expires_at<? OR used_at IS NOT NULL").bind(row.id,now.toISOString()).run();
      await env.DB.prepare("INSERT INTO password_reset_tokens (id,user_id,token_hash,created_at,expires_at,ip,user_agent) VALUES (?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(),row.id,tokenHash,now.toISOString(),expires.toISOString(),request.headers.get("CF-Connecting-IP")||"",request.headers.get("User-Agent")||"").run();
      const resetUrl=appUrl(env)+"?reset="+encodeURIComponent(rawToken);
      const mail=await sendPasswordResetEmail(env,row,resetUrl).catch(function(e){ return {sent:false,detail:String(e&&e.message?e.message:e).slice(0,160)}; });
      sent=!!mail.sent;
    }
    return J({ok:true,email_ready:mailConfigured(env),reset_ready:true},200,cors);
  }
  if(path==="/auth/password-update" && request.method==="POST"){
    if(!(await tableExists(env,"password_reset_tokens"))) return J({error:"schema_reset_missing"},501,cors);
    const parsedBody=await readLimitedJson(request,AUTH_BODY_MAX_BYTES);
    if(!parsedBody.ok) return J({error:parsedBody.error},parsedBody.status,cors);
    const body=parsedBody.body;
    const token=String(body.token||"").trim();
    const password=String(body.password||"");
    if(password.length<8 || password.length>128) return J({error:"weak_password"},400,cors);
    if(!/^[a-f0-9]{64}$/i.test(token)) return J({error:"reset_token_invalid"},400,cors);
    const rate=await consumeAuthRate(env,request,"password_update",token.slice(0,16));
    if(!rate.allowed) return authRateResponse(rate,cors);
    const tokenHash=await sha256Hex(token);
    const now=new Date().toISOString();
    const row=await env.DB.prepare("SELECT prt.id,prt.user_id FROM password_reset_tokens prt WHERE prt.token_hash=? AND prt.expires_at>? AND prt.used_at IS NULL")
      .bind(tokenHash,now).first();
    if(!row) return J({error:"reset_token_invalid"},400,cors);
    const salt=randHex(16);
    const hash=await hashPassword(password,salt);
    await env.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,password_algo=?,updated_at=? WHERE id=?")
      .bind(hash,salt,"pbkdf2-sha256-"+PBKDF2_ITERATIONS,now,row.user_id).run();
    await env.DB.prepare("UPDATE password_reset_tokens SET used_at=? WHERE id=?").bind(now,row.id).run();
    await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(row.user_id).run();
    return J({ok:true},200,cors);
  }
  if(path==="/auth/login" && request.method==="POST"){
    const parsedBody=await readLimitedJson(request,AUTH_BODY_MAX_BYTES);
    if(!parsedBody.ok) return J({error:parsedBody.error},parsedBody.status,cors);
    const body=parsedBody.body;
    const email=cleanEmail(body.email);
    const password=String(body.password||"");
    const rate=await consumeAuthRate(env,request,"login",email||"invalid");
    if(!rate.allowed) return authRateResponse(rate,cors);
    if(password.length<8 || password.length>128) return J({error:"bad_login"},401,cors);
    const row=await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
    if(!row){
      await hashPassword(password,"00000000000000000000000000000000",PBKDF2_ITERATIONS);
      return J({error:"bad_login"},401,cors);
    }
    const storedIterations=passwordIterations(row.password_algo);
    const hash=await hashPassword(password,row.password_salt,storedIterations);
    if(!constantTimeHexEqual(hash,row.password_hash)) return J({error:"bad_login"},401,cors);
    if((await authSecuritySchemaReady(env)) && !row.email_verified_at) return J({error:"email_not_verified"},403,cors);
    if(storedIterations<PBKDF2_ITERATIONS){
      const upgradedSalt=randHex(16);
      const upgradedHash=await hashPassword(password,upgradedSalt,PBKDF2_ITERATIONS);
      const upgradedAt=new Date().toISOString();
      await env.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,password_algo=?,updated_at=? WHERE id=?")
        .bind(upgradedHash,upgradedSalt,"pbkdf2-sha256-"+PBKDF2_ITERATIONS,upgradedAt,row.id).run();
      row.password_hash=upgradedHash; row.password_salt=upgradedSalt; row.password_algo="pbkdf2-sha256-"+PBKDF2_ITERATIONS;
    }
    await attachRoleFlags(env,row);
    const token=await createSession(env,request,row.id);
    return J({token:token,user:publicUser(row),bootstrap:await bootstrapFor(env,row.id),profile:await profileFor(env,row.id),admin:isAdminUser(env,row)},200,cors);
  }
  const user=await authUser(env,request);
  if(!user) return J({error:"unauthorized"},401,cors);
  if(path==="/auth/logout" && request.method==="POST"){
    await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(user.session_id).run();
    return J({ok:true},200,cors);
  }
  if(path==="/me/auth/google/link" && request.method==="POST"){
    if(!googleReady(env)) return J({error:"google_not_configured"},503,cors);
    const body=await readBody(request);
    const returnUrl=allowedReturnUrl(env,body.return_url||appUrl(env));
    try{
      const googleUrl=await createGoogleLinkRequest(env,request,user,returnUrl);
      return J({ok:true,url:googleUrl},200,cors);
    }catch(e){
      return J({error:String(e&&e.error||"google_link_failed")},400,cors);
    }
  }
  if(path==="/me/account" && request.method==="DELETE"){
    const body=await readBody(request);
    if(String(body.confirm||"")!=="DELETE") return J({error:"delete_confirmation_required"},400,cors);
    const reauth=await accountDeletionReauth(user,body);
    if(!reauth.ok) return J({error:reauth.error},403,cors);
    const result=await deleteAccountAndData(env,user);
    return J(result,result.status||200,cors);
  }
  if(path==="/me" && request.method==="GET") return J({user:publicUser(user),admin:isAdminUser(env,user)},200,cors);
  if(path==="/me/profile" && request.method==="GET") return J({profile:await profileFor(env,user.id)},200,cors);
  if(path==="/me/profile" && request.method==="POST"){
    const profile=await upsertProfile(env,user.id,await readBody(request));
    if(!profile) return J({error:"schema_profile_missing",message:"Run the latest D1 migration for user profiles."},501,cors);
    return J({ok:true,profile:profile},200,cors);
  }
  if(path==="/me/bootstrap" && request.method==="GET") return J({user:publicUser(user),bootstrap:await bootstrapFor(env,user.id),profile:await profileFor(env,user.id),admin:isAdminUser(env,user)},200,cors);
  if(path==="/me/bootstrap" && request.method==="POST"){
    const body=await readBody(request);
    for(const id of (Array.isArray(body.wishlist)?body.wishlist:[])) await upsertBottleList(env,user.id,"wishlist",String(id),true,null);
    for(const id of (Array.isArray(body.collection)?body.collection:[])) await upsertBottleList(env,user.id,"collection",String(id),true,null);
    const ratings=body.ratings&&typeof body.ratings==="object"?body.ratings:{};
    for(const id of Object.keys(ratings)) await upsertRating(env,user.id,String(id),ratings[id]);
    return J({user:publicUser(user),bootstrap:await bootstrapFor(env,user.id),profile:await profileFor(env,user.id),admin:isAdminUser(env,user)},200,cors);
  }
  if(path==="/admin/catalog/moderation" && request.method==="GET"){
    if(!isAdminUser(env,user)) return J({error:"forbidden"},403,cors);
    if(!(await catalogModerationSchemaReady(env))) return J({error:"schema_catalog_moderation_missing"},501,cors);
    return J(await adminCatalogModerationList(env,request),200,cors);
  }
  if(path==="/admin/comments/moderation" && request.method==="GET"){
    if(!isAdminUser(env,user)) return J({error:"forbidden"},403,cors);
    if(!(await ugcModerationSchemaReady(env))) return J({error:"ugc_moderation_schema_missing"},501,cors);
    return J(await adminCommentModerationList(env,url.searchParams.get("limit")),200,cors);
  }
  const commentModerationMatch=path.match(/^\/admin\/comments\/moderation\/([^/]+)$/);
  if(commentModerationMatch && request.method==="POST"){
    if(!isAdminUser(env,user)) return J({error:"forbidden"},403,cors);
    if(!(await ugcModerationSchemaReady(env))) return J({error:"ugc_moderation_schema_missing"},501,cors);
    const result=await adminCommentModerationDecision(env,user,decodeURIComponent(commentModerationMatch[1]),await readBody(request));
    return J(result,result.status||200,cors);
  }
  const moderationImageMatch=path.match(/^\/admin\/catalog\/moderation\/([^/]+)\/image$/);
  if(moderationImageMatch && request.method==="GET"){
    if(!isAdminUser(env,user)) return J({error:"forbidden"},403,cors);
    const row=await env.DB.prepare("SELECT review_image_key FROM catalog_moderation_queue WHERE id=? AND admin_status='pending'").bind(decodeURIComponent(moderationImageMatch[1])).first();
    if(!row || !row.review_image_key || !env.BOTTLE_IMAGES) return J({error:"image_not_found"},404,cors);
    const object=await env.BOTTLE_IMAGES.get(row.review_image_key);
    if(!object) return J({error:"image_not_found"},404,cors);
    return new Response(object.body,{headers:responseHeaders(Object.assign({},cors,{"Content-Type":object.httpMetadata&&object.httpMetadata.contentType||"image/webp","Cache-Control":"private, no-store"}))});
  }
  const moderationDecisionMatch=path.match(/^\/admin\/catalog\/moderation\/([^/]+)$/);
  if(moderationDecisionMatch && request.method==="POST"){
    if(!isAdminUser(env,user)) return J({error:"forbidden"},403,cors);
    if(!(await catalogModerationSchemaReady(env))) return J({error:"schema_catalog_moderation_missing"},501,cors);
    const result=await adminCatalogModerationDecision(env,request,user,decodeURIComponent(moderationDecisionMatch[1]),await readBody(request));
    return J(result,result.status&&typeof result.status==="number"?result.status:200,cors);
  }
  if(path==="/admin/reports/summary" && request.method==="GET"){
    if(!isAdminUser(env,user)) return J({error:"forbidden"},403,cors);
    if(!(await telemetrySchemaReady(env))) return J({error:"telemetry_schema_missing"},501,cors);
    return J(await adminReportSummary(env,reportDays(url)),200,cors);
  }
  if(path==="/admin/reports/confusions" && request.method==="GET"){
    if(!isAdminUser(env,user)) return J({error:"forbidden"},403,cors);
    if(!(await telemetrySchemaReady(env))) return J({error:"telemetry_schema_missing"},501,cors);
    return J(await adminConfusions(env,reportDays(url),url.searchParams.get("limit")),200,cors);
  }
  if(path==="/admin/news/refresh" && request.method==="POST"){
    if(!isAdminUser(env,user)) return J({error:"forbidden"},403,cors);
    const result=await refreshWhiskyNews(env,"manual_admin");
    return J(result,result.ok===false?502:200,cors);
  }
  if(path==="/me/wishlist" && request.method==="POST"){
    const body=await readBody(request);
    await upsertBottleList(env,user.id,"wishlist",String(body.bottle_id||""),body.active!==false,body.bottle_data||null);
    return J({ok:true},200,cors);
  }
  if(path==="/me/collection" && request.method==="POST"){
    const body=await readBody(request);
    await upsertBottleList(env,user.id,"collection",String(body.bottle_id||""),body.active!==false,body.bottle_data||null);
    return J({ok:true},200,cors);
  }
  if(path==="/me/private-bottles" && request.method==="GET"){
    if(!(await privateBottleSchemaReady(env))) return J({error:"private_bottle_schema_missing"},501,cors);
    return J({bottles:await privateBottlesFor(env,user.id)},200,cors);
  }
  if(path==="/me/private-bottles" && request.method==="POST"){
    const result=await savePrivateBottle(env,user,await readBody(request));
    return J(result,result.status||200,cors);
  }
  const privateBottleMatch=path.match(/^\/me\/private-bottles\/([^/]+)$/);
  if(privateBottleMatch && request.method==="DELETE"){
    if(!(await privateBottleSchemaReady(env))) return J({error:"private_bottle_schema_missing"},501,cors);
    const id=decodeURIComponent(privateBottleMatch[1]);
    const deleted=await env.DB.prepare("DELETE FROM user_private_bottles WHERE id=? AND user_id=?").bind(id,user.id).run();
    if(Number(deleted&&deleted.meta&&deleted.meta.changes||0)<1) return J({error:"private_bottle_not_found"},404,cors);
    await env.DB.prepare("DELETE FROM user_bottles WHERE user_id=? AND bottle_id=?").bind(user.id,id).run();
    await env.DB.prepare("DELETE FROM user_ratings WHERE user_id=? AND bottle_id=?").bind(user.id,id).run();
    return J({ok:true},200,cors);
  }
  if(path==="/me/rating" && request.method==="POST"){
    const body=await readBody(request);
    const bottleId=String(body.bottle_id||"");
    await upsertRating(env,user.id,bottleId,body.rating);
    return J({ok:true,rating_aggregate:await ratingAggregateFor(env,bottleId)},200,cors);
  }
  if(path==="/me/recommendation" && request.method==="POST"){
    const body=await readBody(request);
    const rec=await upsertRecommendation(env,user,body);
    if(!rec) return J({error:"schema_recommendations_missing",message:"Run the latest D1 migration for bottle recommendations."},501,cors);
    if(rec.error) return J({error:rec.error},400,cors);
    return J({ok:true,recommendation:rec,rating_aggregate:await ratingAggregateFor(env,body.bottle_id)},200,cors);
  }
  if(path==="/me/recommendation/report" && request.method==="POST"){
    const result=await reportRecommendation(env,user,await readBody(request));
    return J(result,result.status||200,cors);
  }
  if(path==="/me/user-block" && request.method==="POST"){
    const result=await blockRecommendationUser(env,user,await readBody(request));
    return J(result,result.status||200,cors);
  }
  if(path==="/me/scan" && request.method==="POST"){
    const body=await readBody(request);
    const result=body.result&&typeof body.result==="object"?body.result:{};
    const now=new Date().toISOString();
    await env.DB.prepare("INSERT INTO scan_history (id,user_id,bottle_id,bottle_name,source,result_json,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(),user.id,String(body.bottle_id||""),String(result.name||body.bottle_name||"").slice(0,180),String(result.source||body.source||"").slice(0,40),JSON.stringify(result).slice(0,50000),now).run();
    return J({ok:true},200,cors);
  }
  if(path==="/me/catalog/submission/preview" && request.method==="POST"){
    const result=await createBottlePreview(env,request,user,await readBody(request));
    return J(result,result.status||200,cors);
  }
  if(path==="/me/catalog/submission/confirm" && request.method==="POST"){
    const result=await confirmBottleSubmission(env,request,user,await readBody(request));
    return J(result,result.status&&typeof result.status==="number"?result.status:200,cors);
  }
  return J({error:"not_found"},404,cors);
}

// dopasowanie rozpoznanej nazwy do bazy
function matchBottle(db, name){
  const nt = toks(name); if(!nt.length) return null;
  const nset = {}; nt.forEach(function(w){ nset[w]=1; });
  const nameNorm=norm(name);
  let best=null, bestScore=0, bestMatched=0;
  (db.bottles||[]).forEach(function(b){
    if(!b || b.scan_disabled) return;
    const bottleNorm=norm(b.name);
    const bt = toks(b.name); if(!bt.length) return;
    let matched=0; bt.forEach(function(w){ if(nset[w]) matched++; });
    let score = matched/bt.length;
    if(nameNorm && bottleNorm && nameNorm===bottleNorm) score=1;
    else if(nameNorm && bottleNorm && (nameNorm.indexOf(bottleNorm)>=0 || bottleNorm.indexOf(nameNorm)>=0)) score=Math.max(score,0.92);
    if(score>bestScore || (score===bestScore && matched>bestMatched)){ best=b; bestScore=score; bestMatched=matched; }
  });
  if(best && bestScore>=0.6 && bestMatched>=1) return { bottle:best, dbConfidence:bestScore, matchedTokens:bestMatched };
  return null;
}

function textBottleScore(text, bottle){
  const nt=toks(text);
  if(!nt.length) return 0;
  const candidates=[(bottle&&bottle.name)||""].concat(Array.isArray(bottle&&bottle.aliases)?bottle.aliases:[]);
  let best=0;
  candidates.forEach(function(candidate){
    const bt=toks(candidate);
    if(!bt.length) return;
    const nset={}; nt.forEach(function(w){ nset[w]=1; });
    const textNorm=norm(text);
    const bottleNorm=norm(candidate);
    if(textNorm && bottleNorm && textNorm===bottleNorm){ best=Math.max(best,1); return; }
    if(textNorm && bottleNorm && textNorm.indexOf(bottleNorm)>=0){
      const coverage=bt.length/nt.length;
      best=Math.max(best,coverage>=0.5 ? Math.min(0.98,0.9+coverage*0.08) : 0.55+coverage*0.35);
      return;
    }
    if(textNorm && bottleNorm && bottleNorm.indexOf(textNorm)>=0){ best=Math.max(best,Math.min(0.88,(nt.length/bt.length)*0.88)); return; }
    let matched=0; bt.forEach(function(w){ if(nset[w]) matched++; });
    if(matched) best=Math.max(best,Math.min(0.9,matched/bt.length));
  });
  return best;
}

const GENERIC_MATCH_TOKENS={
  whiskey:1,whisky:1,bourbon:1,american:1,single:1,malt:1,straight:1,domestic:1,kentucky:1,
  irish:1,scotch:1,japanese:1,canadian:1,tennessee:1,
  blended:1,blend:1,spirit:1,spirits:1,distillery:1,distilling:1,reserve:1,small:1,batch:1,
  barrel:1,cask:1,aged:1,year:1,years:1,proof:1,bottled:1,bond:1,rye:1,grain:1,oak:1,
  finish:1,finished:1,label:1,edition:1,limited:1,release:1,original:1,old:1,bib:1
};
function distinctiveTokens(value){
  const seen={};
  return toks(value).filter(function(token){
    if(GENERIC_MATCH_TOKENS[token] || seen[token]) return false;
    seen[token]=1;
    return true;
  });
}
function bottleDistinctiveTokens(bottle){
  return distinctiveTokens([(bottle&&bottle.name)||""].concat(Array.isArray(bottle&&bottle.aliases)?bottle.aliases:[]).join(" "));
}
function observedDistinctiveTokens(names){
  return distinctiveTokens((names||[]).map(function(item){ return item&&item.name||""; }).join(" "));
}
function sharedTokens(left, right){
  const set={}; (left||[]).forEach(function(token){ set[token]=1; });
  return (right||[]).filter(function(token){ return !!set[token]; });
}
function ageMarker(value){
  const match=norm(value).match(/\b(\d{1,2})\s*(?:year|years|yr|yrs|yo)\b/);
  return match ? match[1] : "";
}

function compactVision(vision){
  vision=vision||{};
  const candidates=Array.isArray(vision.candidates)?vision.candidates.slice(0,5).map(function(c){
    return {name:String((c&&c.name)||"").slice(0,180),confidence:clamp01(c&&c.confidence)};
  }).filter(function(c){ return c.name; }) : [];
  return {
    name:String(vision.name||"").slice(0,180),
    confidence:clamp01(vision.confidence),
    evidence:Array.isArray(vision.evidence)?vision.evidence.slice(0,5).map(function(v){ return String(v||"").slice(0,120); }) : [],
    candidates:candidates
  };
}

function variantMarkers(text){
  text=norm(text);
  const recipe=(text.match(/\b(?:ob|oe)[skqofv]\b/)||[])[0]||"";
  return {
    bonded:/\bbonded\b|\bbottled in bond\b|\bbib\b/.test(text),
    single_barrel:/\bsingle barrel\b|\bsingle cask\b/.test(text),
    barrel_proof:/\bbarrel proof\b|\bcask strength\b|\bfull proof\b/.test(text),
    rye:/\brye\b/.test(text),
    bourbon:/\bbourbon\b/.test(text),
    select:/\bselect\b/.test(text),
    malt:/\bmalt\b/.test(text),
    wheat:/\bwheat\b|\bwheated\b/.test(text),
    finished:/\bfinish(?:ed)?\b|\bsherry cask\b|\bport cask\b|\bfrench oak\b/.test(text),
    double_oaked:/\bdouble oak(?:ed)?\b|\bdouble barrel(?:ed)?\b/.test(text),
    small_batch:/\bsmall batch\b/.test(text),
    recipe:recipe
  };
}

function canonicalRecordScore(bottle){
  let score=0;
  score+=Number(bottle&&bottle.recognition_priority)||0;
  if(bottle&&bottle.image) score+=6;
  if(bottle&&bottle.community_catalog) score+=5;
  if(bottle&&bottle.distillery) score+=2;
  if(Number.isFinite(Number(bottle&&bottle.proof))) score+=1;
  const source=norm(bottle&&bottle.source);
  if(/manual|domwhisky|community/.test(source)) score+=3;
  else if(source==="olcc") score+=2;
  else if(source.indexOf("ttb")>=0) score+=1;
  return score;
}

function candidateIdentity(bottle){
  const declared=norm([bottle&&bottle.name,bottle&&bottle.type,bottle&&bottle.category].filter(Boolean).join(" "));
  const markers=variantMarkers(declared);
  const markerKey=Object.keys(markers).filter(function(key){ return key!=="recipe" && markers[key]; }).sort().join(",");
  const age=(declared.match(/\b(\d{1,2})\s*(?:year|years|yr|yrs|yo)\b/)||[])[1]||"";
  const brand=distinctiveTokens(bottle&&bottle.name||"").slice(0,3).sort().join("-");
  return [brand,markerKey,markers.recipe||"",age].join("|");
}

function scanBottleResult(bottle){
  bottle=bottle||{};
  return {
    id:bottle.id||"",name:bottle.name||"",type:bottle.type||"",category:bottle.category||"",
    distillery:bottle.distillery||"",region:bottle.region||"",mashbill:bottle.mashbill||"",
    abv:bottle.abv,proof:bottle.proof,price:(bottle.price_str||bottle.price_pln||bottle.price||null),
    quality:bottle.quality,value:bottle.value,verdict:"",notes:bottle.notes||"",image:bottle.image||"",
    source:"baza",catalog_status:bottle.catalog_status||"",known_catalog:true,isNew:false
  };
}

function visualAgentTrace(vision, matched){
  const matcher={
    matched:matched&&matched.bottle ? matched.bottle.id : null,
    confidence:matched ? clamp01(matched.dbConfidence) : 0,
    brand_anchors:matched&&matched.brandAnchors ? matched.brandAnchors : [],
    ambiguous:!!(matched&&matched.ambiguous),
    candidate_margin:matched&&Number.isFinite(matched.margin) ? Math.round(matched.margin*1000)/1000 : null,
    matched_fields:matched&&matched.matchedFields ? matched.matchedFields : [],
    candidates:matched&&matched.candidates ? matched.candidates.slice(0,3) : []
  };
  return {
    version:SCAN_ORCHESTRATOR_VERSION,
    visual:compactVision(vision),
    mode:"visual_only",
    matcher:matcher,
    orchestrator:matcher
  };
}

function matchBottleWithVisual(db, vision){
  vision=compactVision(vision);
  const visualNames=[];
  if(vision.name) visualNames.push({name:vision.name,confidence:vision.confidence||0.65,source:"visual"});
  (vision.candidates||[]).forEach(function(c){ if(c.name) visualNames.push({name:c.name,confidence:c.confidence||0.55,source:"visual_candidate"}); });
  const visualDistinctive=observedDistinctiveTokens(visualNames);
  if(!visualDistinctive.length) return null;
  const rows=[];
  const candidateIndexes={};
  const tokenIndex=db.token_index||{};
  visualNames.forEach(function(candidate){
    distinctiveTokens(candidate.name).forEach(function(token){
      (tokenIndex[token]||[]).forEach(function(index){ candidateIndexes[index]=1; });
    });
  });
  const candidateBottles=Object.keys(candidateIndexes).map(function(index){ return (db.bottles||[])[Number(index)]; }).filter(function(bottle){ return bottle && !bottle.scan_disabled; });
  if(!candidateBottles.length) return null;
  candidateBottles.forEach(function(b){
    const bottleDistinctive=bottleDistinctiveTokens(b);
    const lexicalBottleDistinctive=bottleDistinctive.filter(function(token){ return !/^\d+$/.test(token); });
    let bestVisual=null;
    visualNames.forEach(function(item){
      const lexical=textBottleScore(item.name,b);
      const primaryLexical=textBottleScore(item.name,Object.assign({},b,{aliases:[]}));
      const itemNorm=norm(item.name);
      const declared=[b&&b.name].concat(Array.isArray(b&&b.aliases)?b.aliases:[]).map(norm).filter(Boolean);
      const exact=!!(itemNorm && declared.indexOf(itemNorm)>=0);
      const primaryExact=!!(itemNorm && itemNorm===norm(b&&b.name));
      const observedMoreSpecific=toks(item.name).length>toks(b&&b.name).length;
      const databaseScore=!exact && (lexical>primaryLexical || observedMoreSpecific) ? Math.min(lexical,0.89) : lexical;
      const confidence=Math.min(clamp01(item.confidence||0.65),databaseScore);
      if(!bestVisual || confidence>bestVisual.confidence || (confidence===bestVisual.confidence && lexical>bestVisual.lexical)){
        bestVisual={name:item.name,source:item.source,lexical:databaseScore,primaryLexical:primaryLexical,exact:exact,primaryExact:primaryExact,confidence:confidence};
      }
    });
    if(!bestVisual || bestVisual.confidence<0.25) return;
    const observed=distinctiveTokens(bestVisual.name);
    const brandAnchors=sharedTokens(observed,lexicalBottleDistinctive.length?lexicalBottleDistinctive:bottleDistinctive);
    if(!bottleDistinctive.length || !brandAnchors.length) return;
    const bottleContext=distinctiveTokens([(b&&b.name)||"",Array.isArray(b&&b.aliases)?b.aliases.join(" "):"",(b&&b.distillery)||"",(b&&b.region)||""].join(" "));
    const unmatchedObserved=observed.filter(function(token){ return bottleContext.indexOf(token)<0; });
    const observedNumbers=toks(bestVisual.name).filter(function(token){ return /^\d{1,4}$/.test(token); });
    const bottleNumbers=toks(b&&b.name).filter(function(token){ return /^\d{1,4}$/.test(token); });
    const numericConflict=!!(observedNumbers.length&&bottleNumbers.length&&!sharedTokens(observedNumbers,bottleNumbers).length);
    const observedAge=ageMarker(bestVisual.name);
    const bottleAge=ageMarker([(b&&b.name)||"",Array.isArray(b&&b.aliases)?b.aliases.join(" "):""].join(" "));
    const ageConflict=!!(observedAge&&bottleAge&&observedAge!==bottleAge);
    let confidence=bestVisual.confidence;
    if(unmatchedObserved.length) confidence=Math.min(confidence,Math.max(0.7,0.94-unmatchedObserved.length*0.06));
    if(numericConflict) confidence=Math.min(confidence,0.68);
    if(ageConflict) confidence=Math.min(confidence,0.55);
    rows.push({
      bottle:b,
      dbConfidence:confidence,
      brandAnchored:true,
      brandAnchors:brandAnchors,
      matchedFields:["visual","brand_anchor"],
      evidence:{visual:bestVisual.confidence,database:bestVisual.lexical,primary:bestVisual.primaryLexical,exact:bestVisual.exact,primaryExact:bestVisual.primaryExact,source:bestVisual.source,brandAnchors:brandAnchors,unmatchedObserved:unmatchedObserved,numericConflict:numericConflict,observedAge:observedAge,bottleAge:bottleAge,ageConflict:ageConflict}
    });
  });
  rows.sort(function(a,b){
    return b.dbConfidence-a.dbConfidence ||
      Number(b.evidence.primaryExact)-Number(a.evidence.primaryExact) ||
      Number(b.evidence.exact)-Number(a.evidence.exact) ||
      b.evidence.database-a.evidence.database ||
      canonicalRecordScore(b.bottle)-canonicalRecordScore(a.bottle);
  });
  const canonicalRows=[];
  const identities={};
  rows.forEach(function(row){
    const identity=candidateIdentity(row.bottle);
    if(identities[identity]) return;
    identities[identity]=true;
    canonicalRows.push(row);
  });
  const best=canonicalRows[0]||null;
  if(!best) return null;
  const second=canonicalRows[1]||null;
  best.margin=second ? best.dbConfidence-second.dbConfidence : 1;
  best.ambiguous=!!(second && second.dbConfidence>=0.8 && best.margin<0.06);
  best.candidates=canonicalRows.slice(0,5).map(function(r){
    return {id:r.bottle.id,name:r.bottle.name,confidence:clamp01(r.dbConfidence),result:scanBottleResult(r.bottle),evidence:r.evidence,matched_fields:r.matchedFields};
  });
  return best;
}

async function callVisualAgent(env, mime, image, foreground){
  const imageParts=[
    {text:"Pierwszy obraz to pelny kadr z telefonu. Drugi obraz, jezeli wystepuje, to automatycznie odseparowany pierwszy plan z tego samego kadru; moze nadal zawierac dlon albo miec drobne uszkodzenia segmentacji."},
    {inlineData:{mimeType:mime,data:image}}
  ];
  if(foreground&&foreground.byteLength){
    imageParts.push({inlineData:{mimeType:"image/webp",data:encodeBase64(foreground)}});
  }
  const payload={
    __model: env.IDENT_MODEL||"gemini-3.5-flash-lite",
    contents:[{role:"user",parts:[
      {text:"Rozpoznaj dokladna nazwe butelki whisky lub bourbona: marka, wariant oraz widoczny wiek lub edycja. Kadr moze byc przekrzywiony, zrobiony w slabym swietle i zawierac dlon trzymajaca szyjke, regaly, monitor, stol lub inne butelki. Najpierw znajdz glowna butelke i ignoruj wszystko poza nia. Dlon albo zasloniety korek nie oznacza braku butelki, jezeli korpus i etykieta sa czytelne. Najwieksza wage nadaj logo marki, nazwie wariantu, liczbie wieku, tekstowi glownej etykiety, kolorowi etykiety, ksztaltowi butelki oraz oznaczeniom proof i ABV. Polacz dowody z obu obrazow, ale nie wymyslaj niewidocznego wariantu. Zwroc do czterech realnych mozliwych nazw, gdy widoczne cechy pasuja do kilku wariantow. Jesli to nie jest butelka whisky albo nie da sie rozpoznac marki, ustaw name=\"\" i confidence=0."}
    ].concat(imageParts)}],
    generationConfig:{
      maxOutputTokens:260,
      responseMimeType:"application/json",
      responseSchema:{
        type:"OBJECT",
        properties:{
          name:{type:"STRING"},
          confidence:{type:"NUMBER",minimum:0,maximum:1},
          evidence:{type:"ARRAY",items:{type:"STRING"},maxItems:5},
          candidates:{type:"ARRAY",items:{type:"OBJECT",properties:{name:{type:"STRING"},confidence:{type:"NUMBER",minimum:0,maximum:1}},required:["name","confidence"]},maxItems:4}
        },
        required:["name","confidence","evidence","candidates"]
      }
    }
  };
  const r=await callGemini(env,payload,"visual_identification");
  if(r.err) return {err:r.err,data:{},usage:r.usage};
  return {data:parseJson(r.txt)||{},usage:r.usage};
}

function cleanGeminiModelName(value){
  return String(value||"").trim().replace(/^models\//,"").slice(0,120);
}
function uniqueGeminiModels(values){
  const seen={};
  return values.map(cleanGeminiModelName).filter(function(model){
    if(!model || seen[model]) return false;
    seen[model]=true;
    return true;
  });
}
async function availableGeminiModels(env){
  if(_geminiModels.names && Date.now()-_geminiModels.at<10*60*1000) return _geminiModels.names;
  try{
    const url="https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key="+env.GEMINI_API_KEY;
    const response=await fetch(url,{headers:{Accept:"application/json"}});
    if(!response.ok) return null;
    const data=await response.json();
    const names=(Array.isArray(data.models)?data.models:[]).filter(function(model){
      return Array.isArray(model.supportedGenerationMethods) && model.supportedGenerationMethods.indexOf("generateContent")!==-1;
    }).map(function(model){ return cleanGeminiModelName(model.name); }).filter(Boolean);
    if(names.length){
      _geminiModels={names:names,at:Date.now()};
      return names;
    }
  }catch(e){}
  return null;
}
async function geminiModelsForStage(env, payload, stage){
  const visual=stage==="visual_identification" || stage==="bottle_cutout_qa";
  const requested=payload.__model || "";
  const preferred=visual
    ? [requested,env.IDENT_MODEL,"gemini-3.5-flash-lite","gemini-3.6-flash",env.IDENT_FALLBACK_MODEL,env.MODEL,"gemini-3.1-flash-lite"]
    : [requested,stage==="whisky_news"?env.NEWS_MODEL:"","gemini-3.6-flash","gemini-3.5-flash",env.MODEL,"gemini-3.5-flash-lite"];
  const models=uniqueGeminiModels(preferred);
  const available=await availableGeminiModels(env);
  if(!available) return models;
  const allowed={};
  available.forEach(function(model){ allowed[model]=true; });
  const filtered=models.filter(function(model){ return !!allowed[model]; });
  return filtered.length ? filtered : models;
}
function geminiPayloadForModel(payload, model){
  const requestPayload=Object.assign({},payload);
  delete requestPayload.__model;
  if(requestPayload.generationConfig){
    requestPayload.generationConfig=Object.assign({},requestPayload.generationConfig);
    if(/^gemini-3\./.test(model)){
      delete requestPayload.generationConfig.temperature;
      delete requestPayload.generationConfig.topP;
      delete requestPayload.generationConfig.topK;
      delete requestPayload.generationConfig.thinkingConfig;
    }
  }
  return requestPayload;
}
async function callGemini(env, payload, stage){
  const requestedModel=cleanGeminiModelName(payload.__model||env.MODEL||"gemini-3.6-flash");
  const started=Date.now();
  let r=null, st=0, dt="brak odpowiedzi", attempts=0, usedModel=requestedModel;
  if(!env.GEMINI_API_KEY){
    return {err:{status:401,detail:"gemini_missing"},usage:geminiUsage(null,{stage:stage,model:requestedModel,status:401,attempts:0,duration_ms:0})};
  }
  const models=await geminiModelsForStage(env,payload,stage);
  outer: for(let m=0;m<models.length;m++){
    usedModel=models[m];
    const url="https://generativelanguage.googleapis.com/v1beta/models/"+usedModel+":generateContent?key="+env.GEMINI_API_KEY;
    const attemptsPerModel=stage==="visual_identification"?1:2;
    const requestPayload=geminiPayloadForModel(payload,usedModel);
    for(let a=0;a<attemptsPerModel;a++){
      attempts++;
      let rr;
      try{ rr=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(requestPayload)}); }
      catch(e){ st=0; dt="network"; }
      if(rr&&rr.ok){ r=rr; break outer; }
      if(rr){ st=rr.status; dt=(await rr.text()).slice(0,400); }
      if(st===401 || st===403 || st===429) break outer;
      if(st===400 || st===404) break;
      const retryable=st===0||st===408||st===500||st===502||st===503||st===504;
      if(!retryable) break;
      const hasNextAttempt=a<attemptsPerModel-1 || m<models.length-1;
      if(hasNextAttempt){
        const backoff=Math.min(8000,1200*Math.pow(2,attempts-1));
        await sleep(backoff+Math.floor(Math.random()*500));
      }
    }
  }
  if(!r) return { err:{status:st,detail:dt},usage:geminiUsage(null,{stage:stage,model:usedModel,status:st,attempts:attempts,duration_ms:Date.now()-started}) };
  const data=await r.json();
  let txt=""; try{ txt=data.candidates[0].content.parts.map(function(p){return p.text||"";}).join("").trim(); }catch(e){}
  let sources=[];
  try{ sources=(data.candidates[0].groundingMetadata.groundingChunks||[]).filter(function(c){return c.web;}).slice(0,6).map(function(c){return {title:c.web.title||c.web.uri,url:c.web.uri};}); }catch(e){}
  return { txt:txt, sources:sources,usage:geminiUsage(data,{stage:stage,model:usedModel,status:200,attempts:attempts,duration_ms:Date.now()-started}),fallback_used:usedModel!==requestedModel };
}

export default {
  async fetch(request, env, executionCtx){
    const cors=apiCors(env, request);
    if(request.method==="OPTIONS") return new Response(null,{headers:responseHeaders(Object.assign({},cors,{"Access-Control-Max-Age":"600"}))});
    const path=new URL(request.url).pathname;
    if(path.indexOf("/auth/")===0 || path.indexOf("/me")===0 || path.indexOf("/ratings")===0 || path.indexOf("/recommendations")===0 || path.indexOf("/catalog/")===0 || path.indexOf("/telemetry/")===0 || path.indexOf("/admin/")===0 || path.indexOf("/news")===0){
      try{ return await handleApi(request, env, cors); }
      catch(e){
        const requestId=randHex(8);
        console.error("Bourbon Hunters API error",requestId,e);
        return J({error:"server_error",request_id:requestId},500,cors);
      }
    }
    if(request.method!=="POST") return J({error:"POST only"},405,cors);

    let body; try{ body=await request.json(); }catch(e){ return J({error:"bad json"},400,cors); }
    const image=(body.image||"").toString();
    const recognitionImage=(body.recognition_image||"").toString();
    const mime=["image/jpeg","image/png","image/webp"].includes(body.mime)?body.mime:"image/jpeg";
    const lang=["pl","en","es"].includes(body.lang)?body.lang:"pl";
    const mode=body.mode==="analyze"?"analyze":"rate";
    const confirmedId=String(body.confirmed_id||"").trim().slice(0,180);
    if(!image||image.length<100) return J({error:"no image"},400,cors);
    if(image.length>8000000) return J({error:"image too large"},413,cors);
    if(recognitionImage.length>6000000) return J({error:"recognition image too large"},413,cors);
    const imageQuality=body.image_quality&&typeof body.image_quality==="object" ? body.image_quality : null;
    if(imageQuality && imageQuality.acceptable===false){
      const brightness=Number(imageQuality.brightness);
      const contrast=Number(imageQuality.contrast);
      const sharpness=Number(imageQuality.sharpness);
      const unusable=(Number.isFinite(brightness)&&(brightness<20||brightness>245)) ||
        (Number.isFinite(contrast)&&contrast<8) ||
        (Number.isFinite(sharpness)&&sharpness<1.2);
      if(unusable) return J({error:"low_image_quality",retry:true,quality:{brightness:brightness,contrast:contrast,sharpness:sharpness}},200,cors);
    }

    const scanUser=await authUser(env,request);
    const owner=isAdminUser(env,scanUser);
    const scanId=crypto.randomUUID();
    const scanStartedAt=new Date().toISOString();
    const scanStartedMs=Date.now();
    const deviceHash=await telemetryDeviceHash(body.device_id);
    let matched=null, hit=null, bottleName="", visionConfidence=0, ocrConfidence=0, dbConfidence=0, overallConfidence=0, agentTrace=null, confidentHit=false;
    let minConfidence=DEFAULT_MATCH_CONFIDENCE, telemetryUsage=[];
    function trackScan(outcome, extra){
      extra=extra||{};
      const candidates=extra.candidates||[];
      const task=recordScannerRun(env,{
        id:scanId,user_id:scanUser&&scanUser.id,device_hash:deviceHash,actor_type:owner?"admin":(scanUser?"user":"guest"),mode:mode,
        outcome:outcome,error_code:extra.error_code||null,matched_bottle_id:extra.matched_bottle_id||(hit&&hit.id)||null,
        suggested_bottle_id:extra.suggested_bottle_id||(candidates[0]&&candidates[0].id)||null,
        candidates:candidates.map(function(candidate){ return {id:candidate.id,confidence:Number(candidate.confidence)||0}; }),candidate_count:candidates.length,
        confidence:overallConfidence,visual_confidence:visionConfidence,ocr_confidence:ocrConfidence,db_confidence:dbConfidence,min_confidence:minConfidence,
        input_bytes:Math.floor(image.length*0.75),duration_ms:Date.now()-scanStartedMs,started_at:scanStartedAt,completed_at:new Date().toISOString(),usage:telemetryUsage
      }).catch(function(){});
      if(outcome!=="candidates_presented" && executionCtx&&executionCtx.waitUntil) executionCtx.waitUntil(task);
      return task;
    }
    async function scanResponse(payload, status, outcome, extra){
      payload=Object.assign({scan_id:scanId},payload||{});
      if(outcome==="candidates_presented") await trackScan(outcome,extra);
      else trackScan(outcome,extra);
      return J(payload,status,cors);
    }
    let remainingQuota=null;
    if(!confirmedId){
      const identifyBudget=await consumeScannerBudget(env,request,scanUser,deviceHash,"identify");
      if(!identifyBudget.allowed){
        if(identifyBudget.error) return scanResponse({error:identifyBudget.error,retry:false},503,"budget_error",{error_code:identifyBudget.error});
        return scanResponse({limited:true,remaining:0,limit:identifyBudget.limit,budget:"identify",reason:identifyBudget.reason},200,"limited",{error_code:"daily_limit"});
      }
      remainingQuota=identifyBudget.remaining;
    }

    const db=await getDB(env,request);
    minConfidence=clamp01(env.MIN_MATCH_CONFIDENCE||DEFAULT_MATCH_CONFIDENCE) || DEFAULT_MATCH_CONFIDENCE;
    if(mode==="rate" && confirmedId){
      const resolvedConfirmedId=db&&db.id_redirects&&db.id_redirects[confirmedId]||confirmedId;
      hit=(db.bottles||[]).find(function(bottle){ return bottle&&bottle.id===resolvedConfirmedId&&!bottle.scan_disabled; })||null;
      if(!hit) return scanResponse({error:"confirmed_bottle_not_found"},404,"error",{error_code:"confirmed_bottle_not_found"});
      const result=Object.assign({},hit);
      if(!result.image){
        const cutoutBudget=await consumeScannerBudget(env,request,scanUser,deviceHash,"cutout");
        if(!cutoutBudget.allowed){
          if(cutoutBudget.error) return scanResponse({error:cutoutBudget.error,retry:false},503,"budget_error",{error_code:cutoutBudget.error});
          return scanResponse({limited:true,remaining:0,limit:cutoutBudget.limit,budget:"cutout",reason:cutoutBudget.reason},200,"limited",{error_code:"cutout_limit"});
        }
        const cutoutStarted=Date.now();
        try{
          const cutout=await transformBottleCutout(env,mime,image);
          if(cutout){
            const quality=await assessBottleCutout(env,result.name||resolvedConfirmedId,cutout);
            if(quality.usage) recordServiceUsage(env,scanId,scanUser&&scanUser.id,quality.usage).catch(function(){});
            if(quality.acceptable){
              result.image="data:image/webp;base64,"+encodeBase64(cutout);
              result.has_image=true;
              result.source="scan_preview";
              result.temporary_scan_asset=true;
              result.catalog_asset_missing=true;
              result.cutout_quality_checked=quality.checked;
              recordServiceUsage(env,scanId,scanUser&&scanUser.id,{provider:"cloudflare",stage:"image_cutout",model:"cloudflare-images",status:200,attempts:1,duration_ms:Date.now()-cutoutStarted}).catch(function(){});
            }else{
              result.catalog_asset_missing=true;
              result.preview_error="cutout_quality";
              result.preview_reason=quality.reason_code;
              recordServiceUsage(env,scanId,scanUser&&scanUser.id,{provider:"cloudflare",stage:"image_cutout",model:"cloudflare-images",status:422,attempts:1,duration_ms:Date.now()-cutoutStarted}).catch(function(){});
            }
          }
        }catch(e){
          result.catalog_asset_missing=true;
          result.preview_error="image_cutout_failed";
          recordServiceUsage(env,scanId,scanUser&&scanUser.id,{provider:"cloudflare",stage:"image_cutout",model:"cloudflare-images",status:500,attempts:1,duration_ms:Date.now()-cutoutStarted}).catch(function(){});
        }
      }
      dbConfidence=1;
      overallConfidence=1;
      agentTrace={version:SCAN_ORCHESTRATOR_VERSION,confirmed_by_user:true,confirmed_id:resolvedConfirmedId,requested_id:confirmedId};
      return scanResponse({
        result:result,mode:mode,matched:resolvedConfirmedId,confidence:1,
        remaining:remainingQuota,owner:owner,agents:agentTrace
      },200,"confirmed",{matched_bottle_id:resolvedConfirmedId});
    }
    if(mode==="analyze" && confirmedId){
      const resolvedConfirmedId=db&&db.id_redirects&&db.id_redirects[confirmedId]||confirmedId;
      hit=(db.bottles||[]).find(function(bottle){ return bottle&&bottle.id===resolvedConfirmedId; })||null;
      if(!hit) return scanResponse({error:"confirmed_bottle_not_found"},404,"error",{error_code:"confirmed_bottle_not_found"});
      bottleName=hit.name||resolvedConfirmedId;
      dbConfidence=1; overallConfidence=1; confidentHit=true;
      agentTrace={version:SCAN_ORCHESTRATOR_VERSION,confirmed_by_user:true,confirmed_id:resolvedConfirmedId,requested_id:confirmedId};
    } else {
      // Pelny kadr i odseparowany pierwszy plan trafiaja do jednego agenta wizualnego.
      const recognitionSource=recognitionImage.length>=100?recognitionImage:image;
      let recognitionForeground=null;
      const foregroundStarted=Date.now();
      if(env.IMAGES){
        try{
          recognitionForeground=await transformRecognitionForeground(env,mime,recognitionSource);
          if(recognitionForeground) telemetryUsage.push({provider:"cloudflare",stage:"recognition_foreground",model:"cloudflare-images",status:200,attempts:1,duration_ms:Date.now()-foregroundStarted});
        }catch(e){
          telemetryUsage.push({provider:"cloudflare",stage:"recognition_foreground",model:"cloudflare-images",status:500,attempts:1,duration_ms:Date.now()-foregroundStarted});
        }
      }
      const visual=await callVisualAgent(env,mime,recognitionSource,recognitionForeground);
      telemetryUsage.push.apply(telemetryUsage,[visual&&visual.usage].filter(Boolean));
      if(visual&&visual.err){
        const quotaExhausted=visual.err.status===429;
        const providerError=visual.err.status===0?"network":([408,504].includes(visual.err.status)?"timeout":(visual.err.status===503?"overloaded":"unavailable"));
        return scanResponse({error:quotaExhausted?"quota_exhausted":"upstream",status:visual.err.status,provider_error:providerError,retry:!quotaExhausted},quotaExhausted?429:(visual.err.status===0?502:503),quotaExhausted?"quota_exhausted":"upstream_error",{error_code:quotaExhausted?"gemini_quota":"visual_agent_"+providerError});
      }
      const idj=compactVision((visual&&visual.data)||{});
      bottleName=String(idj.name||"").trim();
      if(!bottleName) return scanResponse({error:"not_bottle",agents:visualAgentTrace(idj,null)},200,"not_bottle",{error_code:"no_visual_identity"});
      matched=matchBottleWithVisual(db,idj);
      hit=matched&&matched.bottle ? matched.bottle : null;
      visionConfidence=clamp01(idj.confidence);
      ocrConfidence=0;
      dbConfidence=matched ? clamp01(matched.dbConfidence) : 0;
      overallConfidence=hit ? dbConfidence : 0;
      agentTrace=visualAgentTrace(idj,matched);
      confidentHit=!!(hit && matched.brandAnchored && !matched.ambiguous && overallConfidence>=minConfidence);
    }
    function lowConfidenceResponse(modeName){
      return scanResponse({
        error:"low_confidence",
        needsPro:true,
        mode:modeName,
        candidate:bottleName,
        confidence:overallConfidence,
        visionConfidence:visionConfidence,
        ocrConfidence:ocrConfidence,
        dbConfidence:dbConfidence,
        minConfidence:minConfidence,
        reason:!matched?"brand_not_confirmed":matched.ambiguous?"ambiguous_candidates":"below_confidence_threshold",
        agents:agentTrace
      },200,"low_confidence",{error_code:!matched?"brand_not_confirmed":matched.ambiguous?"ambiguous_candidates":"below_confidence_threshold"});
    }

    // =================== TRYB RATE ===================
    if(mode==="rate"){
      const rankedCandidates=(matched&&matched.candidates||[]);
      const bestCandidate=rankedCandidates[0]||null;
      if(bestCandidate && bestCandidate.confidence>=minConfidence){
        const highConfidenceCandidates=rankedCandidates.filter(function(candidate){
          return candidate.confidence>=MULTI_CANDIDATE_CONFIDENCE;
        }).slice(0,2);
        const candidates=highConfidenceCandidates.length>=2 ? highConfidenceCandidates : [bestCandidate];
        await enrichScanCandidatesWithCatalogAssets(env,request,candidates);
        let scanPreviewImage="";
        const needsScanPreview=candidates.some(function(candidate){ return !(candidate&&candidate.result&&candidate.result.image); });
        if(needsScanPreview){
          if(!env.IMAGES) return scanResponse({error:"image_pipeline_unavailable",retry:true},200,"cutout_failed",{error_code:"image_pipeline_unavailable",candidates:candidates});
          const cutoutBudget=await consumeScannerBudget(env,request,scanUser,deviceHash,"cutout");
          if(!cutoutBudget.allowed){
            if(cutoutBudget.error) return scanResponse({error:cutoutBudget.error,retry:false},503,"budget_error",{error_code:cutoutBudget.error,candidates:candidates});
            return scanResponse({limited:true,remaining:0,limit:cutoutBudget.limit,budget:"cutout",reason:cutoutBudget.reason},200,"limited",{error_code:"cutout_limit",candidates:candidates});
          }
          const cutoutStarted=Date.now();
          try{
            const cutout=await transformBottleCutout(env,mime,image);
            if(!cutout) return scanResponse({error:"image_cutout_failed",retry:true},200,"cutout_failed",{error_code:"empty_cutout",candidates:candidates});
            const quality=await assessBottleCutout(env,candidates[0].name||bottleName,cutout);
            if(quality.usage) telemetryUsage.push(quality.usage);
            telemetryUsage.push({provider:"cloudflare",stage:"scan_candidate_cutout",model:"cloudflare-images",status:quality.acceptable?200:422,attempts:1,duration_ms:Date.now()-cutoutStarted});
            if(!quality.acceptable){
              return scanResponse({error:"cutout_quality",retry:true,reason_code:quality.reason_code},200,"cutout_failed",{error_code:"cutout_quality",candidates:candidates});
            }
            scanPreviewImage="data:image/webp;base64,"+encodeBase64(cutout);
          }catch(e){
            telemetryUsage.push({provider:"cloudflare",stage:"scan_candidate_cutout",model:"cloudflare-images",status:500,attempts:1,duration_ms:Date.now()-cutoutStarted});
            return scanResponse({error:"image_cutout_failed",retry:true},200,"cutout_failed",{error_code:"image_cutout_failed",candidates:candidates});
          }
        }
        const selected=candidates[0];
        const result=Object.assign({},selected.result||{});
        if(scanPreviewImage){
          result.image=scanPreviewImage;
          result.has_image=true;
          result.has_catalog_image=false;
          result.source="scan_preview";
          result.temporary_scan_asset=true;
          result.catalog_asset_missing=true;
        }else{
          result.has_image=!!result.image;
          result.has_catalog_image=!!result.image;
          result.catalog_asset_missing=false;
        }
        overallConfidence=Number(selected.confidence)||overallConfidence;
        dbConfidence=overallConfidence;
        hit=(db.bottles||[]).find(function(bottle){ return bottle&&bottle.id===selected.id; })||hit;
        return scanResponse({result:result,mode:mode,matched:selected.id,confidence:overallConfidence,remaining:remainingQuota,owner:owner,agents:agentTrace},200,"matched",{candidates:candidates,matched_bottle_id:selected.id,suggested_bottle_id:selected.id});
      }
      return lowConfidenceResponse(mode);
    }

    // =================== TRYB ANALYZE ===================
    if(!confidentHit) return lowConfidenceResponse(mode);
    const analysisBudget=await consumeScannerBudget(env,request,scanUser,deviceHash,"analysis");
    if(!analysisBudget.allowed){
      if(analysisBudget.error) return scanResponse({error:analysisBudget.error,retry:false},503,"budget_error",{error_code:analysisBudget.error});
      return scanResponse({limited:true,remaining:0,limit:analysisBudget.limit,budget:"analysis",reason:analysisBudget.reason},200,"limited",{error_code:"analysis_limit"});
    }
    const system=(await getPrompt(env)).replace(/\{\{\s*LANG\s*\}\}/g, langName(lang));
    const profileSchema="{\"en\":{\"general\":\"one short factual sentence\",\"nose\":\"one short tasting sentence\",\"taste\":\"one short tasting sentence\",\"finish\":\"one short tasting sentence\"},\"pl\":{\"general\":\"jedno krotkie zdanie informacyjne\",\"nose\":\"jedno krotkie zdanie degustacyjne\",\"taste\":\"jedno krotkie zdanie degustacyjne\",\"finish\":\"jedno krotkie zdanie degustacyjne\"}}";
    let ctx="Butelka rozpoznana ze zdjecia: \""+bottleName+"\".";
    if(hit){ ctx+=" Dane z naszej bazy (uzyj jako fakty): "+JSON.stringify({name:hit.name,distillery:hit.distillery,region:hit.region,type:hit.type,category:hit.category,proof:hit.proof,mashbill:hit.mashbill,price:(hit.price_str||hit.price_pln),quality:hit.quality,value:hit.value}); }
    const analyzePayload={
      systemInstruction:{parts:[{text:system}]},
      contents:[{role:"user",parts:[{text:ctx+" Prepare an expanded analysis. Research distillery history and relevant facts, include real links. Return ONLY JSON: {\"name\",\"type\",\"category\",\"distillery\",\"region\",\"price\",\"quality\":1-5,\"value\":1-5,\"verdict\":\"one memorable sentence\",\"profile\":"+profileSchema+",\"description\":[\"2-4 paragraphs: flavor profile, who it suits, whether it is worth it\"],\"history\":[\"1-2 paragraphs about the distillery and brand history\"],\"links\":[{\"title\",\"url\"}]}. The profile.en fields must be English. The profile.pl fields must be Polish translations/paraphrases of the same facts. Do not start nose, taste or finish with the bottle name; write only the tasting substance."}]}],
      tools:[{google_search:{}}],
      generationConfig:{ temperature:parseFloat(env.TEMP_ANALYZE||"0.7"), maxOutputTokens:parseInt(env.MAX_ANALYZE||"3500",10), thinkingConfig:{thinkingBudget:parseInt(env.THINK_ANALYZE||"0",10)} }
    };
    const ga=await callGemini(env, analyzePayload,"expanded_analysis");
    if(ga.usage) telemetryUsage.push(ga.usage);
    if(ga.err) return ga.err.status===429
      ? scanResponse({error:"quota_exhausted",status:429,retry:false},429,"quota_exhausted",{error_code:"gemini_quota"})
      : scanResponse({error:"upstream",status:ga.err.status,retry:true},503,"upstream_error",{error_code:"analysis_failed"});
    const ra=parseJson(ga.txt);
    if(!ra) return scanResponse({error:"parse"},502,"error",{error_code:"analysis_parse"});
    if((!ra.links||!ra.links.length) && ga.sources.length) ra.links=ga.sources;
    if(hit){ ra.source="baza"; ra.image=hit.image||""; if(ra.price==null) ra.price=(hit.price_str||hit.price_pln); if(ra.quality==null) ra.quality=hit.quality; if(ra.value==null) ra.value=hit.value; }
    else { ra.source="net"; ra.isNew=true; ra.image=""; }
    return scanResponse({result:ra, mode:mode, remaining:remainingQuota, owner:owner, matched:hit?hit.id:null, confidence:overallConfidence, agents:agentTrace},200,"analyzed",{matched_bottle_id:hit&&hit.id});
  },
  async scheduled(controller, env, ctx){
    const tasks=[cleanupStaleCatalogSubmissions(env,200),cleanupTelemetry(env),cleanupScannerBudgets(env),cleanupAuthRates(env),cleanupNews(env)];
    tasks.push(seedStarterNews(env).then(function(){ return refreshWhiskyNews(env,"scheduled",controller.scheduledTime); }));
    ctx.waitUntil(Promise.all(tasks));
  }
}
