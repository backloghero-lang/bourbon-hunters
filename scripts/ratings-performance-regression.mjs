import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const worker=fs.readFileSync(new URL("../agent/worker.js",import.meta.url),"utf8");
const start=worker.indexOf("function cleanBottleIds(");
const end=worker.indexOf("function cleanRecommendationComment(",start);
assert.ok(start>=0&&end>start,"Rating aggregation block is missing");

const sandbox={};
vm.createContext(sandbox);
vm.runInContext(worker.slice(start,end),sandbox);

const calls=[];
const env={DB:{prepare(sql){
  calls.push({sql,bindings:[]});
  return {bind(...bindings){
    calls[calls.length-1].bindings=bindings;
    return {all:async()=>({results:[
      {bottle_id:"buffalo-trace",count:2,avg:4.5},
      {bottle_id:"eagle-rare",count:1,avg:5}
    ]})};
  }};
}}};

const result=await sandbox.ratingAggregatesFor(env,["buffalo-trace","eagle-rare","unrated","buffalo-trace"]);
assert.equal(calls.length,1,"Ratings must use one grouped D1 query per request");
assert.match(calls[0].sql,/GROUP BY bottle_id/);
assert.deepEqual(calls[0].bindings,["buffalo-trace","eagle-rare","unrated"]);
assert.equal(result["buffalo-trace"].avg,4.5);
assert.equal(result.unrated.count,0);
assert.equal(Object.keys(result).length,3);

console.log("Ratings performance regression passed");
