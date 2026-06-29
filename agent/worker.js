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

const REPO = "backloghero-lang/bourbon-hunters";
const DEFAULT_PROMPT_URL = "https://raw.githubusercontent.com/" + REPO + "/main/agent/prompt.txt";
const DEFAULT_DB_URL = "https://raw.githubusercontent.com/" + REPO + "/main/db/bourbons.json";
const FALLBACK_PROMPT = "Jestes Hunter, kowboj-znawca bourbona z Bourbon Hunters. Krotko, z jajem, ale rzeczowo. quality=jakosc 1-5, value=jakosc/cena 1-5 (5 swietna i tania, 1 slaba i droga). Pisz {{LANG}}. Zwroc tylko JSON.";

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

// dopasowanie rozpoznanej nazwy do bazy
function matchBottle(db, name){
  const nt = toks(name); if(!nt.length) return null;
  const nset = {}; nt.forEach(function(w){ nset[w]=1; });
  let best=null, bestScore=0, bestMatched=0;
  (db.bottles||[]).forEach(function(b){
    const bt = toks(b.name); if(!bt.length) return;
    let matched=0; bt.forEach(function(w){ if(nset[w]) matched++; });
    const score = matched/bt.length;
    if(score>bestScore || (score===bestScore && matched>bestMatched)){ best=b; bestScore=score; bestMatched=matched; }
  });
  if(best && bestScore>=0.6 && bestMatched>=1) return best;
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
    const cors={ "Access-Control-Allow-Origin":env.ALLOW_ORIGIN||"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type" };
    if(request.method==="OPTIONS") return new Response(null,{headers:cors});
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
    const hit=matchBottle(db, bottleName);

    function consume(){ if(!owner && env.DS_KV){ env.DS_KV.put(key,String(used+1),{expirationTtl:90000}); return Math.max(0,LIMIT-(used+1)); } return null; }
    const system=(await getPrompt(env)).replace(/\{\{\s*LANG\s*\}\}/g, langName(lang));

    // =================== TRYB RATE ===================
    if(mode==="rate"){
      if(hit){
        const result={ name:hit.name, type:hit.type, category:hit.category, distillery:hit.distillery, region:hit.region,
          mashbill:hit.mashbill, abv:hit.abv, proof:hit.proof, price:(hit.price_str||hit.price_pln), quality:hit.quality, value:hit.value,
          verdict:hit.desc, notes:hit.notes, image:hit.image||"", source:"baza", isNew:false };
        return J({result:result, mode:mode, remaining:consume(), owner:owner, matched:hit.id}, 200, cors);
      }
      // brak w bazie -> net
      const profileSchema="{\"en\":{\"general\":\"one short factual sentence\",\"nose\":\"one short tasting sentence\",\"taste\":\"one short tasting sentence\",\"finish\":\"one short tasting sentence\"},\"pl\":{\"general\":\"jedno krotkie zdanie informacyjne\",\"nose\":\"jedno krotkie zdanie degustacyjne\",\"taste\":\"jedno krotkie zdanie degustacyjne\",\"finish\":\"jedno krotkie zdanie degustacyjne\"}}";
      const ratePayload={
        systemInstruction:{parts:[{text:system}]},
        contents:[{role:"user",parts:[{text:"Bottle: \""+bottleName+"\". Research reviews and an indicative price, then return ONLY JSON: {\"name\",\"type\",\"category\",\"distillery\",\"region\",\"price\",\"quality\":1-5,\"value\":1-5,\"verdict\",\"profile\":"+profileSchema+",\"notes\"}. The profile.en fields must be English. The profile.pl fields must be Polish translations/paraphrases of the same facts. Do not start nose, taste or finish with the bottle name; write only the tasting substance."}]}],
        tools:[{google_search:{}}],
        generationConfig:{ temperature:parseFloat(env.TEMP_RATE||"0.4"), maxOutputTokens:parseInt(env.MAX_RATE||"1200",10), thinkingConfig:{thinkingBudget:0} }
      };
      const g=await callGemini(env, ratePayload);
      if(g.err) return J({error:"upstream",status:g.err.status,detail:g.err.detail,retry:true},503,cors);
      const r=parseJson(g.txt);
      if(!r) return J({error:"parse",raw:(g.txt||"").slice(0,200)},502,cors);
      r.source="net"; r.isNew=true; r.image="";
      // zapis nowosci do KV (id + zdjecie usera) dla cyklicznego agenta
      if(env.DS_KV){
        const nid=norm(r.name||bottleName).replace(/\s+/g,"-").slice(0,60);
        try{ await env.DS_KV.put("new:"+nid, JSON.stringify({ name:r.name||bottleName, lang:lang, at:new Date().toISOString(), status:"nowosc", data:r, image:image, mime:mime }), {expirationTtl:2592000}); }catch(e){}
        r.savedId=nid;
      }
      return J({result:r, mode:mode, remaining:consume(), owner:owner, matched:null}, 200, cors);
    }

    // =================== TRYB ANALYZE ===================
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
    return J({result:ra, mode:mode, remaining:consume(), owner:owner, matched:hit?hit.id:null}, 200, cors);
  }
}
