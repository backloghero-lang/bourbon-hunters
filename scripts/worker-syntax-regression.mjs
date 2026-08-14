import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../agent/worker.js",import.meta.url),"utf8");
const parsable=source.replace(/export\s+default\s+\{/,"const __workerDefault = {");
assert.notEqual(parsable,source,"Worker module export was not found");
assert.doesNotThrow(()=>new Function(parsable),"Worker must parse as JavaScript");
console.log("Worker syntax regression passed");
