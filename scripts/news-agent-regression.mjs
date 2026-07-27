import fs from "node:fs";
import vm from "node:vm";

let source=fs.readFileSync(new URL("../agent/worker.js",import.meta.url),"utf8");
source=source.replace("export default {","globalThis.__workerDefault={");
source+="\nglobalThis.__newsTest={canonicalNewsUrl,newsSourceForUrl,newsMetaValue,newsCanonicalFromHtml};\n";
const context={URL,console,globalThis:null};
context.globalThis=context;
vm.runInNewContext(source,context,{filename:"worker.js"});

const api=context.__newsTest;
const clean=api.canonicalNewsUrl("https://www.whiskyadvocate.com/News/?utm_source=test&fbclid=abc#latest");
if(clean!=="https://whiskyadvocate.com/News") throw new Error("Canonical URL failed: "+clean);
if(api.canonicalNewsUrl("https://example.com/article")) throw new Error("Unapproved news source was accepted");
if(api.newsSourceForUrl("https://thewhiskeywash.com/story")!=="The Whiskey Wash") throw new Error("Source mapping failed");

const html=`<html><head>
  <link rel="canonical" href="https://www.whiskymag.com/articles/new-release/?utm_campaign=x">
  <meta property="og:title" content="A new &amp; useful whisky story">
  <meta property="og:image" content="https://cdn.example.test/image.jpg">
</head></html>`;
if(api.newsMetaValue(html,"og:title")!=="A new & useful whisky story") throw new Error("Metadata parsing failed");
if(api.newsCanonicalFromHtml(html,"https://www.whiskymag.com/articles/new-release/")!=="https://whiskymag.com/articles/new-release") throw new Error("HTML canonical parsing failed");

console.log(JSON.stringify({ok:true,canonical:clean,sources:4},null,2));
