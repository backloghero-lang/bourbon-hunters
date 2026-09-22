import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const root=path.resolve(import.meta.dirname,"..");
let source=fs.readFileSync(path.join(root,"agent","worker.js"),"utf8");
source=source.replace("export default {","globalThis.__worker={");
source+="\nglobalThis.__providerTest={callGemini};";

function loadWorker(fetchImpl){
  const context={
    console,fetch:fetchImpl,Response,Request,Headers,URL,TextEncoder,TextDecoder,Blob,
    crypto:webcrypto,atob,btoa,
    setTimeout:(fn)=>{ fn(); return 0; },
    clearTimeout:()=>{}
  };
  vm.runInNewContext(source,context,{filename:"worker.js"});
  return context;
}

function successResponse(){
  return new Response(JSON.stringify({
    candidates:[{content:{parts:[{text:'{"name":"Bushmills 12 Year Old","confidence":0.97,"evidence":["label"],"candidates":[]}'}]}}],
    usageMetadata:{promptTokenCount:10,candidatesTokenCount:8,totalTokenCount:18}
  }),{status:200,headers:{"Content-Type":"application/json"}});
}

const retryCalls=[];
let generationAttempt=0;
const retryWorker=loadWorker(async(url)=>{
  const value=String(url);
  retryCalls.push(value);
  if(value.includes("/v1beta/models?")){
    return new Response(JSON.stringify({models:[
      {name:"models/gemini-3.6-flash",supportedGenerationMethods:["generateContent"]}
    ]}),{status:200,headers:{"Content-Type":"application/json"}});
  }
  if(value.includes("gemini-3.6-flash:")){
    generationAttempt++;
    return generationAttempt===1 ? new Response("overloaded",{status:503}) : successResponse();
  }
  throw new Error(`Unexpected URL: ${value}`);
});

const retryResult=await retryWorker.__providerTest.callGemini({
  GEMINI_API_KEY:"test",
  IDENT_MODEL:"gemini-3.6-flash"
},{
  __model:"gemini-3.6-flash",
  contents:[{role:"user",parts:[{text:"identify"}]}],
  generationConfig:{temperature:0,thinkingConfig:{thinkingBudget:0}}
},"visual_identification");

if(retryResult.err) throw new Error(`Same-model retry failed: ${JSON.stringify(retryResult.err)}`);
if(retryResult.usage?.model!=="gemini-3.6-flash") throw new Error(`Unexpected retry model: ${retryResult.usage?.model}`);
if(retryCalls.length!==3) throw new Error(`Expected discovery and a same-model retry ending in success, got ${retryCalls.length}`);

const invalidCalls=[];
const invalidWorker=loadWorker(async(url)=>{
  const value=String(url);
  invalidCalls.push(value);
  if(value.includes("/v1beta/models?")) return new Response("unavailable",{status:503});
  if(value.includes("gemini-3.6-flash:")) return new Response("missing",{status:404});
  throw new Error(`Unexpected URL: ${value}`);
});

const invalidResult=await invalidWorker.__providerTest.callGemini({GEMINI_API_KEY:"test"},{
  __model:"gemini-3.6-flash",
  contents:[{role:"user",parts:[{text:"identify"}]}]
},"visual_identification");

if(invalidResult.err?.status!==404) throw new Error(`Invalid model should fail without switching models: ${JSON.stringify(invalidResult)}`);
if(invalidCalls.length!==2) throw new Error(`Invalid model should not fan out, got ${invalidCalls.length} calls`);

const quotaCalls=[];
const quotaWorker=loadWorker(async(url)=>{
  const value=String(url);
  quotaCalls.push(value);
  if(value.includes("/v1beta/models?")) return new Response("unavailable",{status:503});
  return new Response(JSON.stringify({error:{code:429,message:"Quota exhausted"}}),{status:429});
});
const quotaResult=await quotaWorker.__providerTest.callGemini({GEMINI_API_KEY:"test"},{
  __model:"gemini-3.5-flash-lite",
  contents:[{role:"user",parts:[{text:"identify"}]}]
},"visual_identification");
if(quotaResult.err?.status!==429) throw new Error(`Quota should remain visible: ${JSON.stringify(quotaResult)}`);
if(quotaCalls.length!==2) throw new Error(`Quota must stop without retrying, got ${quotaCalls.length} calls`);

console.log(JSON.stringify({
  ok:true,
  scanner_model:retryResult.usage.model,
  transient_error_retries_same_model:true,
  invalid_model_404_stops:true,
  quota_429_stops:true
},null,2));
