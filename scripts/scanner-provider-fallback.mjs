import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const root=path.resolve(import.meta.dirname,"..");
let source=fs.readFileSync(path.join(root,"agent","worker.js"),"utf8");
source=source.replace("export default {","globalThis.__worker={");
source+="\nglobalThis.__providerTest={callGemini};";

const calls=[];
const context={
  console,
  fetch:async(url)=>{
    calls.push(String(url));
    if(String(url).includes("gemini-2.5-flash:")){
      return new Response(JSON.stringify({
        candidates:[{content:{parts:[{text:'{"name":"Bulleit Bottled in Bond","confidence":0.97,"evidence":["label"],"candidates":[]}'}]}}],
        usageMetadata:{promptTokenCount:10,candidatesTokenCount:8,totalTokenCount:18}
      }),{status:200,headers:{"Content-Type":"application/json"}});
    }
    return new Response(JSON.stringify({error:{code:503,message:"The model is overloaded",status:"UNAVAILABLE"}}),{
      status:503,
      headers:{"Content-Type":"application/json"}
    });
  },
  Response,Request,Headers,URL,TextEncoder,TextDecoder,Blob,
  crypto:webcrypto,atob,btoa,
  setTimeout:(fn)=>{ fn(); return 0; },
  clearTimeout:()=>{}
};

vm.runInNewContext(source,context,{filename:"worker.js"});

const result=await context.__providerTest.callGemini({GEMINI_API_KEY:"test"},{
  __model:"gemini-2.5-flash-lite",
  contents:[{role:"user",parts:[{text:"identify"}]}]
},"visual_identification");

if(result.err) throw new Error(`Fallback failed: ${JSON.stringify(result.err)}`);
if(result.fallback_used!==true) throw new Error("Fallback model was not reported as used");
if(result.usage?.model!=="gemini-2.5-flash") throw new Error(`Unexpected model: ${result.usage?.model}`);
if(calls.length!==2) throw new Error(`Expected one primary call and one fallback call, got ${calls.length}`);
if(!calls[0].includes("gemini-2.5-flash-lite:")) throw new Error("Primary request is missing");
if(!calls[1].includes("gemini-2.5-flash:")) throw new Error("Fallback request is missing");

console.log(JSON.stringify({ok:true,calls:calls.length,fallback_model:result.usage.model,attempts:result.usage.attempts},null,2));
