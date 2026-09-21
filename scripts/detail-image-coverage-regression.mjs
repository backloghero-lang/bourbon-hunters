import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const readJson=(relative)=>JSON.parse(fs.readFileSync(path.join(root,relative),"utf8"));
const catalog=readJson("db/catalog/demo-200.json");
const report=readJson("db/catalog/demo-detail-normalization-report.json");

assert.equal(catalog.bottles.length,200,"Demo catalog must contain exactly 200 bottles");
assert.equal(report.total,200,"Detail image report must cover the full demo catalog");
assert.equal(report.ready,200,"Every demo bottle must have a ready detail image");
assert.equal(report.missing,0,"Detail image report contains missing assets");
assert.equal(report.rejected,0,"Detail image report contains rejected assets");

const reportById=new Map(report.items.map((item)=>[item.id,item]));
for(const bottle of catalog.bottles){
  assert.equal(bottle.demo_image_status,"ready",`${bottle.id} is not marked ready`);
  assert.match(bottle.image,/^assets\/bourbons\/detail-200\/.+\.webp$/,`${bottle.id} does not use a normalized detail image`);
  const item=reportById.get(bottle.id);
  assert.equal(item?.status,"ready",`${bottle.id} is absent from the ready report`);
  assert.deepEqual(item?.output_dimensions,{width:960,height:1280},`${bottle.id} has an invalid detail canvas`);
  const imagePath=path.join(root,...bottle.image.split("/"));
  assert.ok(fs.existsSync(imagePath),`${bottle.id} detail image is missing on disk`);
  assert.ok(fs.statSync(imagePath).size>4_000,`${bottle.id} detail image is unexpectedly small`);
}

console.log(JSON.stringify({ok:true,ready:report.ready,format:report.version},null,2));
