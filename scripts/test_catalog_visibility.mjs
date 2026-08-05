import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require=createRequire(import.meta.url);
const taxonomy=require("../spirit-taxonomy.js");
const root=path.resolve(import.meta.dirname,"..");
const targets=["db/bourbons.json","db/catalog/bottles.json","db/catalog/scan-index.json","db/catalog/browse-whisky.json"];

for(const relative of targets){
  const data=JSON.parse(fs.readFileSync(path.join(root,relative),"utf8"));
  const hidden=(data.bottles||[]).filter((bottle)=>!taxonomy.isVisibleBottle(bottle));
  assert.equal(hidden.length,0,`${relative} contains hidden products: ${hidden.slice(0,5).map((bottle)=>bottle.name).join(", ")}`);
}

const browse=JSON.parse(fs.readFileSync(path.join(root,"db/catalog/browse-whisky.json"),"utf8"));
for(const key of ["flavored","world","other_whisky"]){
  assert.equal(browse.counts?.[key],undefined,`Hidden filter ${key} returned to browse metadata`);
}

const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const styleHelper=html.slice(html.indexOf("function styleChipHtml"),html.indexOf("function familyChipHtml"));
const familyHelper=html.slice(html.indexOf("function familyChipHtml"),html.indexOf("function bottleFilterState"));
assert.ok(!styleHelper.includes("style-all"),"Style filter still renders an All option");
assert.ok(!styleHelper.includes("counts[k]+'</button>"),"Style filter still renders counts");
assert.ok(!familyHelper.includes('family="all"'),"Family filter still renders an All option");
assert.ok(!familyHelper.includes("counts.bourbon+'</button>")&&!familyHelper.includes("counts.whisky+'</button>"),"Family filter still renders counts");

const homeCategories=html.slice(html.indexOf("const HOME_CATEGORIES"),html.indexOf("function bottleFamily"));
assert.ok(homeCategories.indexOf('key:"whisky"')<homeCategories.indexOf('style.key==="proof"'),"Whisky must be the first Home category, directly before Barrel Proof");
const homeCategoryRender=html.slice(html.indexOf('document.getElementById("catGrid").innerHTML'),html.indexOf("// recently added"));
assert.ok(!homeCategoryRender.includes('class="cnt"'),"Home category cards still render item counts");

console.log(JSON.stringify({ok:true,taxonomy:taxonomy.version,browse_count:browse.count,filters:browse.counts},null,2));
