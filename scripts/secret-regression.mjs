import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const ignored=new Set([".git","node_modules","assets","design","artifacts"]);
const textFiles=[];
function walk(directory){
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    if(ignored.has(entry.name)) continue;
    const absolute=path.join(directory,entry.name);
    if(entry.isDirectory()) walk(absolute);
    else if(/\.(?:html|js|mjs|json|md|sql|yml|yaml|toml|txt|bat)$/i.test(entry.name)) textFiles.push(absolute);
  }
}
walk(root);
const forbidden=[
  {name:"Google API key",pattern:/AIza[0-9A-Za-z_-]{30,}/},
  {name:"private key",pattern:/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/},
  {name:"GitHub token",pattern:/gh[pousr]_[0-9A-Za-z]{30,}/},
  {name:"Cloudflare API token",pattern:/\b(?:CF_API_TOKEN|CLOUDFLARE_API_TOKEN)\s*[=:]\s*["']?[A-Za-z0-9_-]{20,}/i},
  {name:"Google client secret",pattern:/\bGOOGLE_CLIENT_SECRET\s*[=:]\s*["']?(?!value|secret|encrypted|example|your-)[A-Za-z0-9_-]{20,}/i}
];

const findings=[];
for(const file of textFiles){
  let content="";
  try{ content=fs.readFileSync(file,"utf8"); }catch{ continue; }
  forbidden.forEach(rule=>{ if(rule.pattern.test(content)) findings.push(rule.name+" in "+path.relative(root,file)); });
}
assert.deepEqual(findings,[],"Potential secrets found:\n"+findings.join("\n"));
console.log("Secret regression passed ("+textFiles.length+" tracked text files)");
