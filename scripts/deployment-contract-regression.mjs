import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const worker=readFileSync(new URL("agent/worker.js",root),"utf8");
const frontend=readFileSync(new URL("index.html",root),"utf8");
const migrations=JSON.parse(readFileSync(new URL("agent/migrations.json",root),"utf8"));

const workerContract=worker.match(/const API_CONTRACT_VERSION = "([^"]+)"/);
const frontendContract=frontend.match(/const API_CONTRACT_VERSION = "([^"]+)"/);
assert.ok(workerContract&&frontendContract,"API contract version is missing");
assert.equal(workerContract[1],frontendContract[1],"Frontend and Worker API contracts differ");
assert.equal(migrations.schema_version,75);
assert.equal(migrations.latest,"d1-migration-v75-data-minimization.sql");
assert.match(worker,/api_contract_version:API_CONTRACT_VERSION/);

console.log(JSON.stringify({ok:true,contract:workerContract[1],schema_version:migrations.schema_version},null,2));
