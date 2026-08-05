import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const worker=fs.readFileSync(new URL("../agent/worker.js",import.meta.url),"utf8");

const sandbox={
  URL,
  location:{href:"https://backloghero-lang.github.io/bourbon-hunters/"},
  WORKER_URL:"https://bourbon-hunters.darekmaslyk.workers.dev"
};
vm.createContext(sandbox);
const helpersStart=html.indexOf("function esc(");
const helpersEnd=html.indexOf("function starStr(",helpersStart);
assert.ok(helpersStart>=0 && helpersEnd>helpersStart,"Security helper block is missing");
vm.runInContext(html.slice(helpersStart,helpersEnd),sandbox);

const escaped=sandbox.esc(`\"><img src=x onerror='globalThis.pwned=1'>`);
assert.equal(escaped.includes('"'),false,"Attribute quotes must be encoded");
assert.equal(escaped.includes("'"),false,"Attribute apostrophes must be encoded");
assert.equal(escaped.includes("<img"),false,"HTML markup must be encoded");

assert.equal(sandbox.safeHttpUrl("javascript:alert(1)",""),"");
assert.equal(sandbox.safeHttpUrl("data:text/html,<script>alert(1)</script>",""),"");
assert.equal(sandbox.safeHttpUrl("https://example.com/article","").startsWith("https://example.com/"),true);

assert.equal(sandbox.safeImageSrc("data:image/svg+xml,<svg onload=alert(1)>",""),"");
assert.equal(sandbox.safeImageSrc("javascript:alert(1)",""),"");
assert.equal(sandbox.safeImageSrc("assets/bourbons/test.webp","").startsWith("https://backloghero-lang.github.io/"),true);
assert.equal(sandbox.safeImageSrc("data:image/webp;base64,QUJDRA==",""),"data:image/webp;base64,QUJDRA==");

assert.equal(sandbox.safeWorkerUrl("https://evil.example/auth/google/callback"),"");
assert.equal(sandbox.safeWorkerUrl("https://bourbon-hunters.darekmaslyk.workers.dev/auth/google/start").startsWith(sandbox.WORKER_URL),true);

assert.match(html,/Content-Security-Policy/);
assert.match(html,/script-src-attr 'none'/);
assert.match(html,/object-src 'none'/);
assert.doesNotMatch(html,/<img[^>]+\sonerror=/i);

const inlineScripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .filter(match=>match[1].trim())
  .map(match=>match[1]);
assert.ok(inlineScripts.length>=2,"Expected application and intro scripts");
inlineScripts.forEach((source,index)=>{
  assert.doesNotThrow(()=>new Function(source),"Inline script "+index+" must parse");
});

assert.match(worker,/SECURITY_VERSION\s*=\s*"xss-url-health-hardening-v1"/);
assert.match(worker,/path==="\/admin\/health"/);
assert.match(worker,/request_id:requestId/);
assert.doesNotMatch(worker,/error:"server_error",detail:/);

console.log("Security/XSS regression passed");
