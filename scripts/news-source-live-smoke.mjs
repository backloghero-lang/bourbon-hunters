import fs from "node:fs";
import vm from "node:vm";

let source=fs.readFileSync(new URL("../agent/worker.js",import.meta.url),"utf8");
source=source.replace("export default {","globalThis.__workerDefault={");
source+="\nglobalThis.__newsLive={newsImageMapFromIndex};\n";
const context={URL,console,globalThis:null};
context.globalThis=context;
vm.runInNewContext(source,context,{filename:"worker.js"});

const pageUrl="https://whiskyadvocate.com/";
const response=await fetch(pageUrl,{headers:{"User-Agent":"Mozilla/5.0 (compatible; BourbonHuntersNewsTest/1.0)",Accept:"text/html"}});
if(!response.ok) throw new Error("Whisky Advocate index returned "+response.status);
const images=context.__newsLive.newsImageMapFromIndex(await response.text(),pageUrl);
const expected=[
  "https://whiskyadvocate.com/dubai-chocolate-and-whisky-pairing",
  "https://whiskyadvocate.com/louisville-rickhouse-whiskey-co-tastings-guide",
  "https://whiskyadvocate.com/first-west-explorer-reviewed"
];
const resolved=expected.map((url)=>({url,image:images[url]||""}));
if(resolved.some((item)=>!item.image)) throw new Error("Missing article thumbnail: "+JSON.stringify(resolved));
if(new Set(resolved.map((item)=>item.image)).size!==expected.length) throw new Error("Article thumbnails are not unique: "+JSON.stringify(resolved));
for(const item of resolved){
  const imageResponse=await fetch(item.image,{headers:{"User-Agent":"Mozilla/5.0 (compatible; BourbonHuntersNewsTest/1.0)",Accept:"image/*"}});
  if(!imageResponse.ok || !String(imageResponse.headers.get("content-type")||"").startsWith("image/")){
    throw new Error("Thumbnail is unavailable: "+JSON.stringify({url:item.url,image:item.image,status:imageResponse.status}));
  }
  await imageResponse.body?.cancel();
}

console.log(JSON.stringify({ok:true,source:pageUrl,articles:resolved},null,2));
