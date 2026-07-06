// Bourbon Hunters - Cloudflare Worker v2 (baza-first + 2 tryby)
//
// Tryb pracy:
//   1) Gemini rozpoznaje NAZWE butelki ze zdjecia (wizja, bez przeszukiwania netu - tanio).
//   2) Szukamy nazwy w bazie db/bourbons.json (z repo).
//   3a) tryb "rate"   -> jest w bazie: zwracamy od razu (zero netu). Brak: liczymy z netem i zapisujemy nowosc do KV.
//   3b) tryb "analyze"-> rozbudowany opis + historia destylarni z linkami (Gemini + Google Search), fakty z bazy jako grunt.
//
// SEKRETY: GEMINI_API_KEY (wymagany), DEV_KEY (opcjonalny)
// ZMIENNE: MODEL, IDENT_MODEL, TEMP_RATE, TEMP_ANALYZE, THINK_ANALYZE, MAX_RATE, MAX_ANALYZE, DAILY_LIMIT, ALLOW_ORIGIN, PROMPT_URL, DB_URL
// KV: DS_KV (limit + zapis nowosci). Klucze nowosci: "new:<id>".
// D1: DB (konta, sesje, wishlist, kolekcja, oceny).

const REPO = "backloghero-lang/bourbon-hunters";
const DEFAULT_PROMPT_URL = "https://raw.githubusercontent.com/" + REPO + "/main/agent/prompt.txt";
const DEFAULT_DB_URL = "https://raw.githubusercontent.com/" + REPO + "/main/db/bourbons.json";
const FALLBACK_PROMPT = "Jestes Hunter, kowboj-znawca bourbona z Bourbon Hunters. Krotko, z jajem, ale rzeczowo. quality=jakosc 1-5, value=jakosc/cena 1-5 (5 swietna i tania, 1 slaba i droga). Pisz {{LANG}}. Zwroc tylko JSON.";
const DEFAULT_MATCH_CONFIDENCE = 0.8;
const AUTH_VERSION = "auth-pbkdf2-100000-v2";
const PBKDF2_ITERATIONS = 100000;

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
async function hashPassword(password, saltHex){
  const salt=new Uint8Array((saltHex.match(/.{1,2}/g)||[]).map(function(x){ return parseInt(x,16); }));
  const key=await crypto.subtle.importKey("raw", encText(password), "PBKDF2", false, ["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:salt,iterations:PBKDF2_ITERATIONS,hash:"SHA-256"}, key, 256);
  return hex(bits);
}
function publicUser(row){ return row ? {id:row.id,email:row.email,username:row.username,created_at:row.created_at} : null; }
function cleanEmail(v){ return String(v||"").trim().toLowerCase(); }
function cleanUsername(v){ return String(v||"").trim().replace(/\s+/g," ").slice(0,40); }
function mailConfigured(env){ return !!(env.RESEND_API_KEY && env.MAIL_FROM); }
function appUrl(env){
  const raw=String(env.APP_URL||"https://backloghero-lang.github.io/bourbon-hunters/").trim()||"https://backloghero-lang.github.io/bourbon-hunters/";
  return raw.replace(/\/?$/,"/");
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
  const out={wishlist:[],collection:[],ratings:{}};
  (bottles.results||[]).forEach(function(r){
    if(r.list_type==="wishlist") out.wishlist.push(r.bottle_id);
    if(r.list_type==="collection") out.collection.push(r.bottle_id);
  });
  (ratings.results||[]).forEach(function(r){ out.ratings[r.bottle_id]=r.rating; });
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
async function handleApi(request, env, cors){
  const url=new URL(request.url);
  const path=url.pathname.replace(/\/+$/,"");
  if(path==="/auth/health" && request.method==="GET"){
    let schema=false, reset_schema=false, detail="";
    if(env.DB){
      try{
        await env.DB.prepare("SELECT id FROM users LIMIT 1").first();
        const cols=await userColumns(env);
        schema=!!(cols.id && cols.email && cols.username && cols.birth_date && cols.age_verified_at);
        if(!schema) detail="users table exists, but age-gate columns are missing";
        reset_schema=await tableExists(env,"password_reset_tokens");
        if(schema && !reset_schema) detail="password_reset_tokens table is missing";
      }
      catch(e){ detail=String(e&&e.message?e.message:e).slice(0,220); }
    }
    return J({ok:true,worker:"bourbon-hunters",auth_version:AUTH_VERSION,pbkdf2_iterations:PBKDF2_ITERATIONS,d1:!!env.DB,schema:schema,reset_schema:reset_schema,email_ready:mailConfigured(env),detail:detail,time:new Date().toISOString()},200,cors);
  }
  const dbErr=needDB(env,cors); if(dbErr) return dbErr;
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
    return J({token:token,user:{id:id,email:email,username:username,created_at:now},bootstrap:{wishlist:[],collection:[],ratings:{}},email_ready:!!mail.sent},200,cors);
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
    return J({token:token,user:publicUser(row),bootstrap:await bootstrapFor(env,row.id)},200,cors);
  }
  const user=await authUser(env,request);
  if(!user) return J({error:"unauthorized"},401,cors);
  if(path==="/auth/logout" && request.method==="POST"){
    await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(user.session_id).run();
    return J({ok:true},200,cors);
  }
  if(path==="/me" && request.method==="GET") return J({user:publicUser(user)},200,cors);
  if(path==="/me/bootstrap" && request.method==="GET") return J({user:publicUser(user),bootstrap:await bootstrapFor(env,user.id)},200,cors);
  if(path==="/me/bootstrap" && request.method==="POST"){
    const body=await readBody(request);
    for(const id of (Array.isArray(body.wishlist)?body.wishlist:[])) await upsertBottleList(env,user.id,"wishlist",String(id),true,null);
    for(const id of (Array.isArray(body.collection)?body.collection:[])) await upsertBottleList(env,user.id,"collection",String(id),true,null);
    const ratings=body.ratings&&typeof body.ratings==="object"?body.ratings:{};
    for(const id of Object.keys(ratings)) await upsertRating(env,user.id,String(id),ratings[id]);
    return J({user:publicUser(user),bootstrap:await bootstrapFor(env,user.id)},200,cors);
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
    await upsertRating(env,user.id,String(body.bottle_id||""),body.rating);
    return J({ok:true},200,cors);
  }
  if(path==="/me/scan" && request.method==="POST"){
    const body=await readBody(request);
    const result=body.result&&typeof body.result==="object"?body.result:{};
    const now=new Date().toISOString();
    await env.DB.prepare("INSERT INTO scan_history (id,user_id,bottle_id,bottle_name,source,result_json,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(),user.id,String(body.bottle_id||""),String(result.name||body.bottle_name||"").slice(0,180),String(result.source||body.source||"").slice(0,40),JSON.stringify(result).slice(0,50000),now).run();
    return J({ok:true},200,cors);
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
    if(path.indexOf("/auth/")===0 || path.indexOf("/me")===0){
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

    // ---- KROK 1: rozpoznanie nazwy (wizja, bez netu) ----
    const identPayload={
      __model: env.IDENT_MODEL||env.MODEL||"gemini-2.5-flash",
      contents:[{role:"user",parts:[
        {inlineData:{mimeType:mime,data:image}},
        {text:"Rozpoznaj dokladna nazwe butelki whisky/bourbona na zdjeciu (marka + nazwa + ewentualny wiek/edycja). Zwroc TYLKO JSON: {\"name\":\"...\",\"confidence\":0.0-1.0}. Jesli to nie butelka whisky, daj name=\"\"."}
      ]}],
      generationConfig:{ temperature:0, maxOutputTokens:120, thinkingConfig:{thinkingBudget:0} }
    };
    const id1=await callGemini(env, identPayload);
    if(id1.err) return J({error:"upstream",status:id1.err.status,detail:id1.err.detail,retry:true}, id1.err.status===0?502:503, cors);
    const idj=parseJson(id1.txt)||{};
    const bottleName=(idj.name||"").toString().trim();
    if(!bottleName) return J({error:"not_bottle"},200,cors);

    const db=await getDB(env);
    const matched=matchBottle(db, bottleName);
    const hit=matched&&matched.bottle ? matched.bottle : null;
    const minConfidence=clamp01(env.MIN_MATCH_CONFIDENCE||DEFAULT_MATCH_CONFIDENCE) || DEFAULT_MATCH_CONFIDENCE;
    const visionConfidence=clamp01(idj.confidence);
    const dbConfidence=matched ? clamp01(matched.dbConfidence) : 0;
    const overallConfidence=hit ? Math.min(visionConfidence||0, dbConfidence) : 0;
    const confidentHit=!!(hit && overallConfidence>=minConfidence);
    function lowConfidenceResponse(modeName){
      return J({
        error:"low_confidence",
        needsPro:true,
        mode:modeName,
        candidate:bottleName,
        confidence:overallConfidence,
        visionConfidence:visionConfidence,
        dbConfidence:dbConfidence,
        minConfidence:minConfidence
      },200,cors);
    }

    function consume(){ if(!owner && env.DS_KV){ env.DS_KV.put(key,String(used+1),{expirationTtl:90000}); return Math.max(0,LIMIT-(used+1)); } return null; }

    // =================== TRYB RATE ===================
    if(mode==="rate"){
      if(confidentHit){
        const result={ name:hit.name, type:hit.type, category:hit.category, distillery:hit.distillery, region:hit.region,
          mashbill:hit.mashbill, abv:hit.abv, proof:hit.proof, price:(hit.price_str||hit.price_pln), quality:hit.quality, value:hit.value,
          verdict:hit.desc, notes:hit.notes, image:hit.image||"", source:"baza", isNew:false };
        return J({result:result, mode:mode, remaining:consume(), owner:owner, matched:hit.id, confidence:overallConfidence}, 200, cors);
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
    return J({result:ra, mode:mode, remaining:consume(), owner:owner, matched:hit?hit.id:null, confidence:overallConfidence}, 200, cors);
  }
}
