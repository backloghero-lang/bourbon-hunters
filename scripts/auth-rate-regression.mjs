import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const migration=readFileSync(resolve(root,"agent/d1-migration-v71-auth-rate-limits.sql"),"utf8");
const db=new DatabaseSync(":memory:");
db.exec(migration);

const insert=db.prepare(`
  INSERT INTO auth_rate_events (id,window_key,actor_hash,ip_hash,operation,created_at)
  SELECT ?,?,?,?,?,?
  WHERE (SELECT COUNT(*) FROM auth_rate_events WHERE window_key=? AND operation=? AND actor_hash=?)<?
    AND (SELECT COUNT(*) FROM auth_rate_events WHERE window_key=? AND operation=? AND ip_hash=?)<?
`);
const add=(id,actor,ip,actorLimit=3,ipLimit=5)=>insert.run(
  id,"window-1",actor,ip,"login","2026-08-06T12:00:00Z",
  "window-1","login",actor,actorLimit,
  "window-1","login",ip,ipLimit
).changes;

assert.equal(add("1","actor-a","ip-a"),1);
assert.equal(add("2","actor-a","ip-a"),1);
assert.equal(add("3","actor-a","ip-a"),1);
assert.equal(add("4","actor-a","ip-a"),0,"Actor limit must block the next request");
assert.equal(add("5","actor-b","ip-a"),1);
assert.equal(add("6","actor-c","ip-a"),1);
assert.equal(add("7","actor-d","ip-a"),0,"IP limit must block the next request");
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM auth_rate_events").get().count,5);
db.close();

console.log(JSON.stringify({ok:true,migration:"v71",actor_limit:true,ip_limit:true,atomic_insert:true},null,2));
