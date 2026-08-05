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

const discoveryCalls=[];
const discoveryWorker=loadWorker(async(url)=>{
  const value=String(url);
  discoveryCalls.push(value);
  if(value.includes("/v1beta/models?")){
    return new Response(JSON.stringify({models:[
      {name:"models/gemini-3.5-flash-lite",supportedGenerationMethods:["generateContent"]},
      {name:"models/gemini-3.6-flash",supportedGenerationMethods:["generateContent"]}
    ]}),{status:200,headers:{"Content-Type":"application/json"}});
  }
  if(value.includes("gemini-3.5-flash-lite:")){
    return new Response(JSON.stringify({error:{code:404,message:"Model not found"}}),{status:404});
  }
  if(value.includes("gemini-3.6-flash:")) return successResponse();
  throw new Error(`Unexpected URL: ${value}`);
});

const discoveryResult=await discoveryWorker.__providerTest.callGemini({
  GEMINI_API_KEY:"test",
  MODEL:"gemini-2.5-flash"
},{
  __model:"gemini-2.5-flash-lite",
  contents:[{role:"user",parts:[{text:"identify"}]}],
  generationConfig:{temperature:0,thinkingConfig:{thinkingBudget:0}}
},"visual_identification");

if(discoveryResult.err) throw new Error(`Discovery fallback failed: ${JSON.stringify(discoveryResult.err)}`);
if(discoveryResult.usage?.model!=="gemini-3.6-flash") throw new Error(`Unexpected discovered model: ${discoveryResult.usage?.model}`);
if(discoveryCalls.some((url)=>url.includes("gemini-2.5-flash:"))) throw new Error("Unavailable legacy model should be filtered by discovery");
if(discoveryCalls.length!==3) throw new Error(`Expected discovery plus two model calls, got ${discoveryCalls.length}`);

const directCalls=[];
const directWorker=loadWorker(async(url)=>{
  const value=String(url);
  directCalls.push(value);
  if(value.includes("/v1beta/models?")) return new Response("unavailable",{status:503});
  if(value.includes("gemini-2.5-flash-lite:")) return new Response("missing",{status:404});
  if(value.includes("gemini-3.5-flash-lite:")) return successResponse();
  throw new Error(`Unexpected URL: ${value}`);
});

const directResult=await directWorker.__providerTest.callGemini({GEMINI_API_KEY:"test"},{
  __model:"gemini-2.5-flash-lite",
  contents:[{role:"user",parts:[{text:"identify"}]}]
},"visual_identification");

if(directResult.err) throw new Error(`404 fallback failed: ${JSON.stringify(directResult.err)}`);
if(directResult.usage?.model!=="gemini-3.5-flash-lite") throw new Error(`Unexpected direct fallback: ${directResult.usage?.model}`);
if(directCalls.length!==3) throw new Error(`Expected list failure and two model calls, got ${directCalls.length}`);

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
if(quotaCalls.length!==2) throw new Error(`Quota must not fan out across models, got ${quotaCalls.length} calls`);

console.log(JSON.stringify({
  ok:true,
  discovery_fallback_model:discoveryResult.usage.model,
  direct_fallback_model:directResult.usage.model,
  invalid_model_404_continues:true,
  quota_429_stops:true
},null,2));
