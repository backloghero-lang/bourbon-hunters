import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root=path.resolve(import.meta.dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const match=html.match(/const STARTER_RECOMMENDATION_SETS = (\[[\s\S]*?\]);\s*const RUNTIME_IMAGE_DIR/);
assert.ok(match,"Starter recommendation data is missing");
const sets=vm.runInNewContext(match[1]);
const catalogs=["db/bourbons.json","db/catalog/bottles.json"].flatMap((relative)=>{
  return JSON.parse(fs.readFileSync(path.join(root,relative),"utf8")).bottles||[];
});
const byId=new Map(catalogs.map((bottle)=>[bottle.id,bottle]));

assert.equal(sets.length,10,"Recommended feed must contain ten starter bottles");
const reviews=sets.flatMap((set)=>set.reviews||[]);
assert.ok(reviews.length>=30&&reviews.length<=50,"Expected an average of 3-5 reviews per bottle");

for(const set of sets){
  const bottle=byId.get(set.bottle_id);
  assert.ok(bottle,`Missing recommended bottle: ${set.bottle_id}`);
  assert.ok(bottle.image||bottle.thumb,`Recommended bottle has no image: ${set.bottle_id}`);
  assert.ok(set.reviews.length>=3&&set.reviews.length<=5,`Unexpected review count for ${set.bottle_id}`);
  for(const review of set.reviews){
    assert.ok(Number(review[2])>=3&&Number(review[2])<=5,`Starter rating must be between 3 and 5 for ${set.bottle_id}`);
    assert.ok(String(review[3]||"").length>=30&&String(review[4]||"").length>=30,`Starter review is too short for ${set.bottle_id}`);
  }
}

const average=Math.round(reviews.length/sets.length*10)/10;
console.log(JSON.stringify({ok:true,bottles:sets.length,reviews:reviews.length,average_reviews:average},null,2));
