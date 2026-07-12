// Bourbon Hunters - Cloudflare Worker v2 (baza-first + 2 tryby)
//
// Tryb pracy:
//   1) Visual agent rozpoznaje butelke ze zdjecia.
//   2) OCR agent czyta tekst z etykiety: marka, wariant, proof/ABV, kategoria.
//   3) Orchestrator laczy dowody z obu agentow i szuka najlepszego dopasowania w indeksie 10k.
//   4a) tryb "rate"   -> jest w bazie: zwracamy od razu (zero netu).
//   4b) tryb "analyze"-> rozbudowany opis + historia destylarni z linkami (Gemini + Google Search), fakty z bazy jako grunt.
//
// SEKRETY: GEMINI_API_KEY (wymagany), DEV_KEY (opcjonalny)
// ZMIENNE: MODEL, IDENT_MODEL, TEMP_RATE, TEMP_ANALYZE, THINK_ANALYZE, MAX_RATE, MAX_ANALYZE, DAILY_LIMIT, ALLOW_ORIGIN, PROMPT_URL, DB_URL, APP_URL, GOOGLE_REDIRECT_URI
// SEKRETY OAuth: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, opcjonalnie GOOGLE_STATE_SECRET
// KV: DS_KV (limit + zapis nowosci). Klucze nowosci: "new:<id>".
// D1: DB (konta, sesje, wishlist, kolekcja, oceny).

const REPO = "backloghero-lang/bourbon-hunters";
const DEFAULT_PROMPT_URL = "https://raw.githubusercontent.com/" + REPO + "/main/agent/prompt.txt";
const DEFAULT_DB_URL = "https://raw.githubusercontent.com/" + REPO + "/main/db/catalog/scan-index.json";
const FALLBACK_PROMPT = "Jestes Hunter, kowboj-znawca bourbona z Bourbon Hunters. Krotko, z jajem, ale rzeczowo. quality=jakosc 1-5, value=jakosc/cena 1-5 (5 swietna i tania, 1 slaba i droga). Pisz {{LANG}}. Zwroc tylko JSON.";
const DEFAULT_MATCH_CONFIDENCE = 0.8;
const SCAN_ORCHESTRATOR_VERSION = "ocr-visual-fusion-catalog-10k-v3-strict-brand";
const SCAN_CATALOG_VERSION = "ttb-olcc-10k-v1";
const CATALOG_SUBMISSION_VERSION = "community-catalog-images-v2-trim-centered";
const AUTH_VERSION = "auth-pbkdf2-100000-google-v3";
const PBKDF2_ITERATIONS = 100000;
const PROFILE_BADGE_IDS = ["glass","bottle","barrel","seal","hat","star","distillery","notes","opener","horseshoe"];

let _p = { t:null, at:0 }, _db = { d:null, at:0 };
async function getText(url, ttl){ const r = await fetch(url, { cf:{ cacheTtl:ttl, cacheEverything:true } }); return r.ok ? await r.text() : null; }
async function getPrompt(env){
  const now=Date.now(); if(_p.t && now-_p.at<60000) return _p.t;
  try{ const t=await getText(env.PROMPT_URL||DEFAULT_PROMPT_URL,60); if(t&&t.trim()){_p={t:t,at:now};return t;} }catch(e){}
  return _p.t||FALLBACK_PROMPT;
}
async function getDB(env){
  const now=Date.now(); if(_db.d && now-_db.at<300000) return _db.d;
  try{ const t=await getText(env.DB_URL||DEFAULT_DB_URL,300); if(t){ const j=JSON.parse(t); _db={d:j,at:now}; return j; } }catch(e){}
  return _db.d||{bottles:[]};
}

function langName(l){ return l==="en"?"in English":l==="es"?"en espanol":"po polsku"; }
function J(o,s,c){ return new Response(JSON.stringify(o),{status:s,headers:Object.assign({"Content-Type":"application/json"},c)}); }
function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
function norm(s){ return (s||"").toString().toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim(); }
function toks(s){ return norm(s).split(" ").filter(function(w){ return w.length>=3 || /^[0-9]+$/.test(w); }); }
function parseJson(txt){ if(!txt) return null; let s=txt.replace(/```json/gi,"").replace(/```/g,"").trim(); const a=s.indexOf("{"),b=s.lastIndexOf("}"); if(a<0||b<0||b<a) return null; try{return JSON.parse(s.slice(a,b+1));}catch(e){return null;} }
function clamp01(n){ n=Number(n); if(!Number.isFinite(n)) return 0; if(n>1) n=n/100; return Math.max(0,Math.min(1,n)); }
function encText(s){ return new TextEncoder().encode(String(s||"")); }
function hex(bytes){ return Array.from(new Uint8Array(bytes)).map(function(b){ return b.toString(16).padStart(2,"0"); }).join(""); }
function randHex(bytes){ const a=new Uint8Array(bytes); crypto.getRandomValues(a); return hex(a); }
async function sha256Hex(s){ return hex(await crypto.subtle.digest("SHA-256", encText(s))); }
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
async function hashPassword(password, saltHex){
  const salt=new Uint8Array((saltHex.match(/.{1,2}/g)||[]).map(function(x){ return parseInt(x,16); }));
  const key=await crypto.subtle.importKey("raw", encText(password), "PBKDF2", false, ["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:salt,iterations:PBKDF2_ITERATIONS,hash:"SHA-256"}, key, 256);
  return hex(bits);
}
function publicUser(row){ return row ? {id:row.id,email:row.email,username:row.username,created_at:row.created_at} : null; }
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
function corsOrigin(value){
  value=String(value||"").trim();
  if(!value || value==="*") return value||"*";
  try{ return new URL(value).origin; }catch(e){ return value.replace(/\/+$/,""); }
}
function apiCors(env, request){
  const raw=String(env.ALLOW_ORIGIN||"*").trim();
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
function publicCatalogBottle(row, request){
  const data=safeJson(row&&row.bottle_data,{});
  data.id=row.bottle_id;
  data.name=data.name||row.bottle_name;
  data.source="community_catalog";
  data.isNew=true;
  data.added_at=row.created_at;
  data.image=row.image_submission_id ? new URL("/catalog/image/"+encodeURIComponent(row.bottle_id)+"?v="+encodeURIComponent(row.updated_at||row.created_at||"1"),request.url).toString() : "";
  data.has_image=!!row.image_submission_id;
  return data;
}
async function deleteSubmissionImages(env, row){
  if(!env.BOTTLE_IMAGES || !row) return;
  const keys=[row.original_key,row.processed_key].filter(Boolean);
  if(keys.length) await env.BOTTLE_IMAGES.delete(keys);
}
async function createBottlePreview(env, request, user, body){
  if(!(await tableExists(env,"bottle_submissions")) || !(await tableExists(env,"catalog_bottles"))) return {error:"schema_catalog_missing",status:501};
  const bottle=cleanCatalogBottle(body&&body.bottle_data);
  bottle.id=cleanCatalogId((body&&body.bottle_id)||bottle.id);
  if(!bottle.id || !bottle.name) return {error:"bad_bottle",status:400};
  if(!catalogPriceAllowed(bottle)) return {error:"price_limit",status:400};
  const today=new Date(); today.setUTCHours(0,0,0,0);
  const count=await env.DB.prepare("SELECT COUNT(*) AS count FROM bottle_submissions WHERE user_id=? AND created_at>=?").bind(user.id,today.toISOString()).first();
  if(Number(count&&count.count)>=10) return {error:"submission_limit",status:429};
  const image=String((body&&body.image)||"");
  const mime=["image/jpeg","image/png","image/webp"].includes(body&&body.mime)?body.mime:"image/jpeg";
  if(!image || image.length<100 || image.length>8000000) return {error:"bad_image",status:400};
  const id=crypto.randomUUID();
  const now=new Date().toISOString();
  const originalKey="catalog/submissions/"+user.id+"/"+id+"/original";
  const processedKey="catalog/submissions/"+user.id+"/"+id+"/bottle.webp";
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
    const output=await env.IMAGES.input(new Blob([bytes],{type:mime}).stream())
      .transform({segment:"foreground"})
      .transform({trim:"border"})
      .transform({width:820,height:1080,fit:"contain",background:"transparent",sharpen:1})
      .output({format:"image/webp"});
    const response=output.response();
    if(!response.ok) throw new Error("image_transform_"+response.status);
    const processed=new Uint8Array(await response.arrayBuffer());
    await env.BOTTLE_IMAGES.put(processedKey,processed,{httpMetadata:{contentType:"image/webp",cacheControl:"public, max-age=31536000, immutable"}});
    await env.DB.prepare("UPDATE bottle_submissions SET original_key=?,processed_key=?,status='awaiting_confirmation',updated_at=? WHERE id=?")
      .bind(originalKey,processedKey,new Date().toISOString(),id).run();
    return {submission_id:id,preview_ready:true,image_pipeline_ready:true,preview_data_url:"data:image/webp;base64,"+encodeBase64(processed)};
  }catch(e){
    if(env.BOTTLE_IMAGES) await env.BOTTLE_IMAGES.delete([originalKey,processedKey]).catch(function(){});
    await env.DB.prepare("UPDATE bottle_submissions SET status='awaiting_confirmation',updated_at=? WHERE id=?").bind(new Date().toISOString(),id).run();
    return {submission_id:id,preview_ready:false,image_pipeline_ready:true,preview_error:String(e&&e.message?e.message:e).slice(0,120)};
  }
}
async function confirmBottleSubmission(env, request, user, body){
  if(!(await tableExists(env,"bottle_submissions")) || !(await tableExists(env,"catalog_bottles"))) return {error:"schema_catalog_missing",status:501};
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
  if(decision==="without_image") await deleteSubmissionImages(env,row);
  const now=new Date().toISOString();
  const imageSubmission=decision==="accept" ? row.id : null;
  await env.DB.prepare("INSERT INTO catalog_bottles (bottle_id,bottle_name,bottle_data,image_submission_id,source_user_id,status,created_at,updated_at) VALUES (?,?,?,?,?,'published',?,?) ON CONFLICT(bottle_id) DO UPDATE SET bottle_name=excluded.bottle_name,bottle_data=excluded.bottle_data,image_submission_id=COALESCE(excluded.image_submission_id,catalog_bottles.image_submission_id),status='published',updated_at=excluded.updated_at")
    .bind(row.bottle_id,row.bottle_name,row.bottle_data,imageSubmission,user.id,now,now).run();
  await env.DB.prepare("UPDATE bottle_submissions SET status='published',image_choice=?,original_key=?,processed_key=?,updated_at=? WHERE id=?")
    .bind(decision,decision==="accept"?row.original_key:null,decision==="accept"?row.processed_key:null,now,id).run();
  const published=await env.DB.prepare("SELECT * FROM catalog_bottles WHERE bottle_id=?").bind(row.bottle_id).first();
  return {ok:true,status:"published",bottle:publicCatalogBottle(published,request)};
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
async function authUser(env, request){
  const h=request.headers.get("Authorization")||"";
  const m=h.match(/^Bearer\s+(.+)$/i);
  if(!m || !env.DB) return null;
  const tokenHash=await sha256Hex(m[1].trim());
  const row=await env.DB.prepare("SELECT users.id,users.email,users.username,users.created_at,sessions.id AS session_id FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?")
    .bind(tokenHash, new Date().toISOString()).first();
  return row || null;
}
async function bootstrapFor(env, userId){
  const bottles=await env.DB.prepare("SELECT bottle_id,list_type FROM user_bottles WHERE user_id=?").bind(userId).all();
  const ratings=await env.DB.prepare("SELECT bottle_id,rating FROM user_ratings WHERE user_id=?").bind(userId).all();
  const out={wishlist:[],collection:[],ratings:{},recommendations_count:0};
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
    .slice(0,150);
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
  const out={};
  for(const id of cleanBottleIds(ids)){
    out[id]=await ratingAggregateFor(env,id);
  }
  return out;
}
function cleanRecommendationComment(v){
  return String(v||"").replace(/\s+/g," ").trim().slice(0,700);
}
async function recommendationsFor(env, bottleId, limit){
  if(!(await tableExists(env,"bottle_recommendations"))) return {ready:false,recommendations:[]};
  const hasProfiles=await tableExists(env,"user_profiles");
  limit=Math.max(1,Math.min(100,Number(limit)||40));
  const selectProfile=hasProfiles ? "COALESCE(up.badge,'glass') AS badge" : "'glass' AS badge";
  const joinProfile=hasProfiles ? " LEFT JOIN user_profiles up ON up.user_id=br.user_id" : "";
  const base="SELECT br.id,br.user_id,br.bottle_id,br.bottle_name,br.rating,br.comment,br.created_at,br.updated_at,u.username,"+selectProfile+" FROM bottle_recommendations br JOIN users u ON u.id=br.user_id"+joinProfile+" WHERE br.active=1";
  const sql=bottleId ? base+" AND br.bottle_id=? ORDER BY br.updated_at DESC LIMIT ?" : base+" ORDER BY br.updated_at DESC LIMIT ?";
  const stmt=env.DB.prepare(sql);
  const rows=bottleId ? await stmt.bind(String(bottleId||"").slice(0,180),limit).all() : await stmt.bind(limit).all();
  return {ready:true,recommendations:(rows.results||[]).map(function(r){
    return {
      id:r.id,
      user_id:r.user_id,
      bottle_id:r.bottle_id,
      bottle_name:r.bottle_name,
      username:r.username,
      badge:cleanProfileBadge(r.badge),
      rating:Number(r.rating)||0,
      comment:r.comment||"",
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
  await env.DB.prepare("INSERT INTO bottle_recommendations (id,user_id,bottle_id,bottle_name,rating,comment,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,bottle_id) DO UPDATE SET bottle_name=excluded.bottle_name,rating=excluded.rating,comment=excluded.comment,active=1,updated_at=excluded.updated_at")
    .bind(id,user.id,bottleId,bottleName,rating,comment,1,now,now).run();
  await upsertRating(env,user.id,bottleId,rating);
  const recs=await recommendationsFor(env,bottleId,20);
  const mine=(recs.recommendations||[]).filter(function(r){ return r.user_id===user.id; })[0] || null;
  return mine;
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
async function googleUserLogin(env, request, googleUser){
  if(!(await tableExists(env,"auth_identities"))) throw {error:"schema_google_missing"};
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
    row=await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
    if(!row){
      const id=crypto.randomUUID();
      const salt=randHex(16);
      const hash=await sha256Hex("google:"+providerId+":"+randHex(16));
      const username=await availableUsername(env,googleUser.name||email,email);
      await env.DB.prepare("INSERT INTO users (id,email,username,password_hash,password_salt,password_algo,birth_date,age_gate_country,age_gate_min,age_verified_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(id,email,username,hash,salt,"google-oauth2",null,"google",ageGateMin(env),now,now,now).run();
      row=await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first();
      created=true;
    }
    await env.DB.prepare("INSERT INTO auth_identities (provider,provider_user_id,user_id,email,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(provider,provider_user_id) DO UPDATE SET user_id=excluded.user_id,email=excluded.email,updated_at=excluded.updated_at")
      .bind(provider,providerId,row.id,email,now,now).run();
  } else if(row.email!==email){
    await env.DB.prepare("UPDATE auth_identities SET email=?,updated_at=? WHERE provider=? AND provider_user_id=?")
      .bind(email,now,provider,providerId).run();
  }
  const token=await createSession(env,request,row.id);
  if(created) sendWelcomeEmail(env,{email:row.email,username:row.username}).catch(function(){});
  return {token:token,user:publicUser(row),bootstrap:await bootstrapFor(env,row.id),profile:await profileFor(env,row.id),created:created};
}
async function handleApi(request, env, cors){
  const url=new URL(request.url);
  const path=url.pathname.replace(/\/+$/,"");
  if(path==="/auth/health" && request.method==="GET"){
    let schema=false, reset_schema=false, profile_schema=false, recommendations_schema=false, identity_schema=false, catalog_schema=false, detail="";
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
        catalog_schema=(await tableExists(env,"bottle_submissions")) && (await tableExists(env,"catalog_bottles"));
        if(schema && reset_schema && profile_schema && recommendations_schema && identity_schema && !catalog_schema) detail="catalog submission tables are missing";
      }
      catch(e){ detail=String(e&&e.message?e.message:e).slice(0,220); }
    }
    return J({ok:true,worker:"bourbon-hunters",auth_version:AUTH_VERSION,scan_orchestrator_version:SCAN_ORCHESTRATOR_VERSION,scan_catalog_version:SCAN_CATALOG_VERSION,catalog_submission_version:CATALOG_SUBMISSION_VERSION,pbkdf2_iterations:PBKDF2_ITERATIONS,d1:!!env.DB,schema:schema,reset_schema:reset_schema,profile_schema:profile_schema,recommendations_schema:recommendations_schema,identity_schema:identity_schema,catalog_schema:catalog_schema,image_pipeline_ready:!!(env.IMAGES&&env.BOTTLE_IMAGES),email_ready:mailConfigured(env),google_ready:googleReady(env),google_redirect_uri:env.GOOGLE_REDIRECT_URI?googleRedirectUri(env,request):"",detail:detail,time:new Date().toISOString()},200,cors);
  }
  if(path==="/auth/google/start" && request.method==="GET"){
    const returnUrl=allowedReturnUrl(env,url.searchParams.get("return")||appUrl(env));
    if(!googleReady(env)) return redirectWithHash(returnUrl,{google_error:"google_not_configured"});
    const state=await makeGoogleState(env,{return_url:returnUrl,iat:Date.now(),nonce:randHex(8)});
    const googleUrl=new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleUrl.searchParams.set("client_id",String(env.GOOGLE_CLIENT_ID));
    googleUrl.searchParams.set("redirect_uri",googleRedirectUri(env,request));
    googleUrl.searchParams.set("response_type","code");
    googleUrl.searchParams.set("scope","openid email profile");
    googleUrl.searchParams.set("state",state);
    googleUrl.searchParams.set("prompt","select_account");
    return Response.redirect(googleUrl.toString(),302);
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
      const data=await googleUserLogin(env,request,googleUser);
      return redirectWithHash(returnUrl,{google_token:data.token,google_login:"ok",google_new:data.created?1:0});
    }catch(e){
      return redirectWithHash(returnUrl,{google_error:String((e&&e.error)||"google_failed").slice(0,80)});
    }
  }
  const dbErr=needDB(env,cors); if(dbErr) return dbErr;
  if(path==="/catalog/recent" && request.method==="GET"){
    if(!(await tableExists(env,"catalog_bottles"))) return J({bottles:[],catalog_ready:false},200,cors);
    const limit=Math.max(1,Math.min(50,Number(url.searchParams.get("limit")||24)));
    const rows=await env.DB.prepare("SELECT * FROM catalog_bottles WHERE status='published' ORDER BY created_at DESC LIMIT ?").bind(limit).all();
    return J({bottles:(rows.results||[]).map(function(row){ return publicCatalogBottle(row,request); }),catalog_ready:true},200,cors);
  }
  if(path.indexOf("/catalog/image/")===0 && request.method==="GET"){
    if(!(await tableExists(env,"catalog_bottles")) || !env.BOTTLE_IMAGES) return J({error:"image_not_found"},404,cors);
    const bottleId=decodeURIComponent(path.slice("/catalog/image/".length));
    const row=await env.DB.prepare("SELECT bs.processed_key FROM catalog_bottles cb JOIN bottle_submissions bs ON bs.id=cb.image_submission_id WHERE cb.bottle_id=? AND cb.status='published'").bind(bottleId).first();
    if(!row || !row.processed_key) return J({error:"image_not_found"},404,cors);
    const object=await env.BOTTLE_IMAGES.get(row.processed_key);
    if(!object) return J({error:"image_not_found"},404,cors);
    const headers=new Headers(cors);
    object.writeHttpMetadata(headers);
    headers.set("Content-Type",headers.get("Content-Type")||"image/webp");
    headers.set("Cache-Control","public, max-age=86400");
    if(object.httpEtag) headers.set("ETag",object.httpEtag);
    return new Response(object.body,{headers:headers});
  }
  if(path==="/ratings" && request.method==="GET"){
    const ids=cleanBottleIds(url.searchParams.get("ids")||"");
    return J({ratings:await ratingAggregatesFor(env,ids)},200,cors);
  }
  if(path==="/recommendations" && request.method==="GET"){
    const bottleId=String(url.searchParams.get("bottle_id")||"").trim();
    const data=await recommendationsFor(env,bottleId,Number(url.searchParams.get("limit")||40));
    return J({recommendations:data.recommendations,recommendations_ready:data.ready},200,cors);
  }
  if(path==="/auth/register" && request.method==="POST"){
    const body=await readBody(request);
    const email=cleanEmail(body.email);
    const username=cleanUsername(body.username);
    const password=String(body.password||"");
    const birthDate=cleanBirthDate(body.birth_date||body.birthDate);
    const minAge=ageGateMin(env);
    const ageCountry=String(body.age_gate_country||body.country||"global").trim().slice(0,24)||"global";
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return J({error:"bad_email"},400,cors);
    if(!/^[a-zA-Z0-9_.-]{2,40}$/.test(username)) return J({error:"bad_username"},400,cors);
    if(password.length<8) return J({error:"weak_password"},400,cors);
    if(!birthDate) return J({error:"age_required",min_age:minAge},400,cors);
    if(!isOldEnough(birthDate,minAge)) return J({error:"age_restricted",min_age:minAge},403,cors);
    const emailExists=await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
    if(emailExists) return J({error:"email_exists"},409,cors);
    const usernameExists=await env.DB.prepare("SELECT id FROM users WHERE username=?").bind(username).first();
    if(usernameExists) return J({error:"username_exists",suggestions:await suggestUsernames(env,username,email)},409,cors);
    const cols=await userColumns(env);
    if(!cols.birth_date || !cols.age_verified_at) return J({error:"schema_age_missing",message:"Run the latest D1 migration for age-gate columns."},501,cors);
    const salt=randHex(16);
    const hash=await hashPassword(password,salt);
    const now=new Date().toISOString();
    const id=crypto.randomUUID();
    await env.DB.prepare("INSERT INTO users (id,email,username,password_hash,password_salt,password_algo,birth_date,age_gate_country,age_gate_min,age_verified_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,email,username,hash,salt,"pbkdf2-sha256-"+PBKDF2_ITERATIONS,birthDate,ageCountry,minAge,now,now,now).run();
    const token=await createSession(env,request,id);
    const mail=await sendWelcomeEmail(env,{email:email,username:username}).catch(function(e){ return {sent:false,detail:String(e&&e.message?e.message:e).slice(0,160)}; });
    return J({token:token,user:{id:id,email:email,username:username,created_at:now},bootstrap:{wishlist:[],collection:[],ratings:{}},profile:await profileFor(env,id),email_ready:!!mail.sent},200,cors);
  }
  if(path==="/auth/password-reset" && request.method==="POST"){
    const body=await readBody(request);
    const email=cleanEmail(body.email);
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return J({error:"bad_email"},400,cors);
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
    return J({ok:true,email_ready:sent,reset_ready:true},200,cors);
  }
  if(path==="/auth/password-update" && request.method==="POST"){
    if(!(await tableExists(env,"password_reset_tokens"))) return J({error:"schema_reset_missing"},501,cors);
    const body=await readBody(request);
    const token=String(body.token||"").trim();
    const password=String(body.password||"");
    if(password.length<8) return J({error:"weak_password"},400,cors);
    if(!/^[a-f0-9]{64}$/i.test(token)) return J({error:"reset_token_invalid"},400,cors);
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
    const body=await readBody(request);
    const email=cleanEmail(body.email);
    const password=String(body.password||"");
    const row=await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
    if(!row) return J({error:"bad_login"},401,cors);
    const hash=await hashPassword(password,row.password_salt);
    if(hash!==row.password_hash) return J({error:"bad_login"},401,cors);
    const token=await createSession(env,request,row.id);
    return J({token:token,user:publicUser(row),bootstrap:await bootstrapFor(env,row.id),profile:await profileFor(env,row.id)},200,cors);
  }
  const user=await authUser(env,request);
  if(!user) return J({error:"unauthorized"},401,cors);
  if(path==="/auth/logout" && request.method==="POST"){
    await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(user.session_id).run();
    return J({ok:true},200,cors);
  }
  if(path==="/me" && request.method==="GET") return J({user:publicUser(user)},200,cors);
  if(path==="/me/profile" && request.method==="GET") return J({profile:await profileFor(env,user.id)},200,cors);
  if(path==="/me/profile" && request.method==="POST"){
    const profile=await upsertProfile(env,user.id,await readBody(request));
    if(!profile) return J({error:"schema_profile_missing",message:"Run the latest D1 migration for user profiles."},501,cors);
    return J({ok:true,profile:profile},200,cors);
  }
  if(path==="/me/bootstrap" && request.method==="GET") return J({user:publicUser(user),bootstrap:await bootstrapFor(env,user.id),profile:await profileFor(env,user.id)},200,cors);
  if(path==="/me/bootstrap" && request.method==="POST"){
    const body=await readBody(request);
    for(const id of (Array.isArray(body.wishlist)?body.wishlist:[])) await upsertBottleList(env,user.id,"wishlist",String(id),true,null);
    for(const id of (Array.isArray(body.collection)?body.collection:[])) await upsertBottleList(env,user.id,"collection",String(id),true,null);
    const ratings=body.ratings&&typeof body.ratings==="object"?body.ratings:{};
    for(const id of Object.keys(ratings)) await upsertRating(env,user.id,String(id),ratings[id]);
    return J({user:publicUser(user),bootstrap:await bootstrapFor(env,user.id),profile:await profileFor(env,user.id)},200,cors);
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
  blended:1,blend:1,spirit:1,spirits:1,distillery:1,distilling:1,reserve:1,small:1,batch:1,
  barrel:1,cask:1,aged:1,year:1,years:1,proof:1,bottled:1,bond:1,rye:1,grain:1,oak:1,
  finish:1,finished:1,label:1,edition:1,limited:1,release:1,original:1
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

function numberFrom(v){
  const m=String(v||"").replace(",",".").match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
}

function ocrCandidateName(ocr){
  ocr=ocr||{};
  const parts=[ocr.brand,ocr.name,ocr.expression,ocr.age].map(function(v){ return String(v||"").trim(); }).filter(Boolean);
  return parts.join(" ").replace(/\s+/g," ").trim();
}

function ocrHasSignal(ocr){
  if(!ocr) return false;
  return !!(ocr.raw_text||ocr.text||ocr.brand||ocr.name||ocr.expression||ocr.proof||ocr.abv||ocr.category);
}

function compactOcr(ocr){
  ocr=ocr||{};
  return {
    raw_text:String(ocr.raw_text||ocr.text||"").slice(0,700),
    brand:String(ocr.brand||"").slice(0,90),
    name:String(ocr.name||"").slice(0,140),
    expression:String(ocr.expression||"").slice(0,120),
    age:String(ocr.age||"").slice(0,50),
    proof:String(ocr.proof||"").slice(0,40),
    abv:String(ocr.abv||"").slice(0,40),
    category:String(ocr.category||ocr.type||"").slice(0,80),
    confidence:clamp01(ocr.confidence)
  };
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

function fieldEvidenceScore(bottle, ocr){
  const matched=[];
  let score=0;
  const op=numberFrom(ocr&&ocr.proof);
  const bp=numberFrom(bottle&&bottle.proof);
  if(op && bp && Math.abs(op-bp)<=1){ score+=0.08; matched.push("proof"); }
  const oa=numberFrom(ocr&&ocr.abv);
  const ba=numberFrom(bottle&&bottle.abv);
  if(oa && ba && Math.abs(oa-ba)<=0.7){ score+=0.06; matched.push("abv"); }
  const oc=norm((ocr&&ocr.category)||"");
  const bc=norm(((bottle&&bottle.category)||"")+" "+((bottle&&bottle.type)||""));
  if(oc && bc && (bc.indexOf(oc)>=0 || oc.indexOf(bc)>=0)){ score+=0.04; matched.push("category"); }
  return {score:score,matched:matched};
}

function scanAgentTrace(vision, ocr, matched){
  return {
    version:SCAN_ORCHESTRATOR_VERSION,
    visual:compactVision(vision),
    ocr:compactOcr(ocr),
    orchestrator:{
      matched:matched&&matched.bottle ? matched.bottle.id : null,
      confidence:matched ? clamp01(matched.dbConfidence) : 0,
      brand_anchors:matched&&matched.brandAnchors ? matched.brandAnchors : [],
      ambiguous:!!(matched&&matched.ambiguous),
      candidate_margin:matched&&Number.isFinite(matched.margin) ? Math.round(matched.margin*1000)/1000 : null,
      matched_fields:matched&&matched.matchedFields ? matched.matchedFields : [],
      candidates:matched&&matched.candidates ? matched.candidates.slice(0,3) : []
    }
  };
}

function matchBottleWithEvidence(db, vision, ocr){
  vision=compactVision(vision);
  ocr=compactOcr(ocr);
  const visualNames=[];
  if(vision.name) visualNames.push({name:vision.name,confidence:vision.confidence||0.65,source:"visual"});
  (vision.candidates||[]).forEach(function(c){ if(c.name) visualNames.push({name:c.name,confidence:c.confidence||0.55,source:"visual_candidate"}); });
  const ocn=ocrCandidateName(ocr);
  const ocrNames=[];
  if(ocn) ocrNames.push({name:ocn,confidence:ocr.confidence||0.65,source:"ocr_fields"});
  if(ocr.raw_text) ocrNames.push({name:ocr.raw_text,confidence:Math.min(ocr.confidence||0.55,0.72),source:"ocr_raw"});
  const visualDistinctive=observedDistinctiveTokens(visualNames);
  const ocrDistinctive=observedDistinctiveTokens(ocn?[{name:ocn}]:[]);
  const observedDistinctive=distinctiveTokens(visualDistinctive.concat(ocrDistinctive).join(" "));
  if(!observedDistinctive.length) return null;
  const rows=[];
  const candidateIndexes={};
  const tokenIndex=db.token_index||{};
  visualNames.concat(ocrNames).forEach(function(candidate){
    distinctiveTokens(candidate.name).forEach(function(token){
      (tokenIndex[token]||[]).forEach(function(index){ candidateIndexes[index]=1; });
    });
  });
  const candidateBottles=Object.keys(candidateIndexes).map(function(index){ return (db.bottles||[])[Number(index)]; }).filter(Boolean);
  if(!candidateBottles.length) return null;
  candidateBottles.forEach(function(b){
    const bottleDistinctive=bottleDistinctiveTokens(b);
    const brandAnchors=sharedTokens(observedDistinctive,bottleDistinctive);
    if(!bottleDistinctive.length || !brandAnchors.length) return;
    const visualAnchors=sharedTokens(visualDistinctive,bottleDistinctive);
    const ocrAnchors=sharedTokens(ocrDistinctive,bottleDistinctive);
    let bestVisual=0, bestOcr=0;
    visualNames.forEach(function(v){ bestVisual=Math.max(bestVisual,textBottleScore(v.name,b)*clamp01(v.confidence)); });
    ocrNames.forEach(function(v){ bestOcr=Math.max(bestOcr,textBottleScore(v.name,b)*clamp01(v.confidence)); });
    let sum=0, weight=0;
    if(visualNames.length){ sum+=bestVisual*0.56; weight+=0.56; }
    if(ocrNames.length){ sum+=bestOcr*0.52; weight+=0.52; }
    if(!weight) return;
    const fields=fieldEvidenceScore(b,ocr);
    const agreement=(bestVisual>=0.72 && bestOcr>=0.72) ? 0.08 : 0;
    const brandAgreement=(visualAnchors.length && ocrAnchors.length) ? 0.08 : 0;
    let confidence=clamp01((sum/weight)+fields.score+agreement+0.08+brandAgreement);
    if(visualDistinctive.length && ocrDistinctive.length && (!visualAnchors.length || !ocrAnchors.length)) confidence=Math.min(confidence,0.79);
    if(confidence<0.25) return;
    rows.push({
      bottle:b,
      dbConfidence:confidence,
      brandAnchored:true,
      brandAnchors:brandAnchors,
      matchedFields:fields.matched.concat(bestVisual>=0.55?["visual"]:[]).concat(bestOcr>=0.55?["ocr"]:[]).concat(["brand_anchor"]),
      evidence:{visual:bestVisual,ocr:bestOcr,fieldBoost:fields.score,agreementBoost:agreement,brandBoost:0.08+brandAgreement,brandAnchors:brandAnchors}
    });
  });
  rows.sort(function(a,b){ return b.dbConfidence-a.dbConfidence; });
  const best=rows[0]||null;
  if(!best) return null;
  const second=rows[1]||null;
  best.margin=second ? best.dbConfidence-second.dbConfidence : 1;
  best.ambiguous=!!(second && second.dbConfidence>=0.72 && best.margin<0.08);
  best.candidates=rows.slice(0,5).map(function(r){
    return {id:r.bottle.id,name:r.bottle.name,confidence:clamp01(r.dbConfidence),evidence:r.evidence,matched_fields:r.matchedFields};
  });
  return best;
}

async function callVisualAgent(env, mime, image){
  const payload={
    __model: env.IDENT_MODEL||env.MODEL||"gemini-2.5-flash",
    contents:[{role:"user",parts:[
      {inlineData:{mimeType:mime,data:image}},
      {text:"Act as the Bourbon Hunters visual recognition agent. Identify the whisky/bourbon bottle from the image using label layout, bottle shape, logo and visible text. Return ONLY JSON: {\"name\":\"brand + expression if known\",\"confidence\":0.0-1.0,\"evidence\":[\"short visual clues\"],\"candidates\":[{\"name\":\"candidate\",\"confidence\":0.0-1.0}]}. If this is not a whisky bottle, use name=\"\" and confidence=0."}
    ]}],
    generationConfig:{ temperature:0, maxOutputTokens:260, thinkingConfig:{thinkingBudget:0} }
  };
  const r=await callGemini(env,payload);
  if(r.err) return {err:r.err,data:{}};
  return {data:parseJson(r.txt)||{}};
}

async function callOcrAgent(env, mime, image){
  const payload={
    __model: env.OCR_MODEL||env.IDENT_MODEL||env.MODEL||"gemini-2.5-flash",
    contents:[{role:"user",parts:[
      {inlineData:{mimeType:mime,data:image}},
      {text:"Act as an OCR agent for whisky labels. Read visible label text and extract factual fields. Do not guess beyond the label. Return ONLY JSON: {\"raw_text\":\"all readable label text\",\"brand\":\"\",\"name\":\"\",\"expression\":\"\",\"age\":\"\",\"proof\":\"\",\"abv\":\"\",\"category\":\"\",\"confidence\":0.0-1.0}. If no useful label text is readable, raw_text=\"\" and confidence=0."}
    ]}],
    generationConfig:{ temperature:0, maxOutputTokens:420, thinkingConfig:{thinkingBudget:0} }
  };
  const r=await callGemini(env,payload);
  if(r.err) return {err:r.err,data:{}};
  return {data:parseJson(r.txt)||{}};
}

async function callGemini(env, payload){
  const model = payload.__model || env.MODEL || "gemini-2.5-flash";
  delete payload.__model;
  const url = "https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent?key="+env.GEMINI_API_KEY;
  let r=null, st=0, dt="brak odpowiedzi";
  for(let a=0;a<3;a++){
    let rr; try{ rr=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}); }
    catch(e){ st=0; dt="network"; await sleep(700*(a+1)); continue; }
    if(rr.ok){ r=rr; break; }
    st=rr.status; dt=(await rr.text()).slice(0,400);
    if(st===503||st===429||st===500){ await sleep(900*(a+1)); continue; }
    break;
  }
  if(!r) return { err:{status:st,detail:dt} };
  const data=await r.json();
  let txt=""; try{ txt=data.candidates[0].content.parts.map(function(p){return p.text||"";}).join("").trim(); }catch(e){}
  let sources=[];
  try{ sources=(data.candidates[0].groundingMetadata.groundingChunks||[]).filter(function(c){return c.web;}).slice(0,6).map(function(c){return {title:c.web.title||c.web.uri,url:c.web.uri};}); }catch(e){}
  return { txt:txt, sources:sources };
}

export default {
  async fetch(request, env){
    const cors=apiCors(env, request);
    if(request.method==="OPTIONS") return new Response(null,{headers:cors});
    const path=new URL(request.url).pathname;
    if(path.indexOf("/auth/")===0 || path.indexOf("/me")===0 || path.indexOf("/ratings")===0 || path.indexOf("/recommendations")===0 || path.indexOf("/catalog/")===0){
      try{ return await handleApi(request, env, cors); }
      catch(e){ return J({error:"server_error",detail:String(e&&e.message?e.message:e).slice(0,240)},500,cors); }
    }
    if(request.method!=="POST") return J({error:"POST only"},405,cors);

    let body; try{ body=await request.json(); }catch(e){ return J({error:"bad json"},400,cors); }
    const image=(body.image||"").toString();
    const mime=["image/jpeg","image/png","image/webp"].includes(body.mime)?body.mime:"image/jpeg";
    const lang=["pl","en","es"].includes(body.lang)?body.lang:"pl";
    const mode=body.mode==="analyze"?"analyze":"rate";
    if(!image||image.length<100) return J({error:"no image"},400,cors);
    if(image.length>8000000) return J({error:"image too large"},413,cors);

    const owner=!!(env.DEV_KEY && body.dev && body.dev.toString()===env.DEV_KEY);
    const LIMIT=parseInt(env.DAILY_LIMIT||"30",10);
    const ip=request.headers.get("CF-Connecting-IP")||"anon";
    const key="q:"+ip+":"+new Date().toISOString().slice(0,10);
    let used=0;
    if(!owner && env.DS_KV && LIMIT>0){ used=parseInt((await env.DS_KV.get(key))||"0",10); if(used>=LIMIT) return J({limited:true,remaining:0,limit:LIMIT},200,cors); }

    // ---- KROK 1: visual agent + OCR agent (bez netu, rownolegle) ----
    const agents=await Promise.all([
      callVisualAgent(env,mime,image),
      callOcrAgent(env,mime,image)
    ]);
    const visualErr=agents[0]&&agents[0].err;
    const ocrErr=agents[1]&&agents[1].err;
    if(visualErr && ocrErr) return J({error:"upstream",status:visualErr.status||ocrErr.status,detail:(visualErr.detail||ocrErr.detail||"agent_error"),retry:true}, (visualErr.status||ocrErr.status)===0?502:503, cors);
    const idj=compactVision((agents[0]&&agents[0].data)||{});
    const ocrj=compactOcr((agents[1]&&agents[1].data)||{});
    const bottleName=(idj.name||ocrCandidateName(ocrj)||"").toString().trim();
    if(!bottleName && !ocrHasSignal(ocrj)) return J({error:"not_bottle",agents:scanAgentTrace(idj,ocrj,null)},200,cors);

    const db=await getDB(env);
    const matched=matchBottleWithEvidence(db, idj, ocrj);
    const hit=matched&&matched.bottle ? matched.bottle : null;
    const minConfidence=clamp01(env.MIN_MATCH_CONFIDENCE||DEFAULT_MATCH_CONFIDENCE) || DEFAULT_MATCH_CONFIDENCE;
    const visionConfidence=clamp01(idj.confidence);
    const ocrConfidence=clamp01(ocrj.confidence);
    const dbConfidence=matched ? clamp01(matched.dbConfidence) : 0;
    const overallConfidence=hit ? dbConfidence : 0;
    const agentTrace=scanAgentTrace(idj,ocrj,matched);
    const confidentHit=!!(hit && matched.brandAnchored && !matched.ambiguous && overallConfidence>=minConfidence);
    function lowConfidenceResponse(modeName){
      return J({
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
      },200,cors);
    }

    function consume(){ if(!owner && env.DS_KV){ env.DS_KV.put(key,String(used+1),{expirationTtl:90000}); return Math.max(0,LIMIT-(used+1)); } return null; }

    // =================== TRYB RATE ===================
    if(mode==="rate"){
      if(confidentHit){
        const result={ name:hit.name, type:hit.type, category:hit.category, distillery:hit.distillery, region:hit.region,
          mashbill:hit.mashbill, abv:hit.abv, proof:hit.proof, price:(hit.price_str||hit.price_pln), quality:hit.quality, value:hit.value,
          verdict:"", notes:hit.notes, image:hit.image||"", source:"baza", isNew:false };
        return J({result:result, mode:mode, remaining:consume(), owner:owner, matched:hit.id, confidence:overallConfidence, agents:agentTrace}, 200, cors);
      }
      return lowConfidenceResponse(mode);
    }

    // =================== TRYB ANALYZE ===================
    if(!confidentHit) return lowConfidenceResponse(mode);
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
    const ga=await callGemini(env, analyzePayload);
    if(ga.err) return J({error:"upstream",status:ga.err.status,detail:ga.err.detail,retry:true},503,cors);
    const ra=parseJson(ga.txt);
    if(!ra) return J({error:"parse",raw:(ga.txt||"").slice(0,200)},502,cors);
    if((!ra.links||!ra.links.length) && ga.sources.length) ra.links=ga.sources;
    if(hit){ ra.source="baza"; ra.image=hit.image||""; if(ra.price==null) ra.price=(hit.price_str||hit.price_pln); if(ra.quality==null) ra.quality=hit.quality; if(ra.value==null) ra.value=hit.value; }
    else { ra.source="net"; ra.isNew=true; ra.image=""; }
    return J({result:ra, mode:mode, remaining:consume(), owner:owner, matched:hit?hit.id:null, confidence:overallConfidence, agents:agentTrace}, 200, cors);
  }
}
