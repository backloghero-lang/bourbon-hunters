import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const migration=readFileSync(resolve(root,"agent/d1-migration-v72-private-bottles.sql"),"utf8");
const canonicalSchema=readFileSync(resolve(root,"agent/d1-schema.sql"),"utf8");

const canonical=new DatabaseSync(":memory:");
canonical.exec("PRAGMA foreign_keys = ON");
canonical.exec(canonicalSchema);
assert.equal(canonical.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='user_private_bottles'").get().count,1);
canonical.close();

const db=new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON");
db.exec(`
  CREATE TABLE users (id TEXT PRIMARY KEY);
  INSERT INTO users (id) VALUES ('owner-1'), ('owner-2');
`);
db.exec(migration);
db.prepare("INSERT INTO user_private_bottles (id,user_id,name,created_at,updated_at) VALUES (?,?,?,?,?)")
  .run("private-owner-1-a","owner-1","My bottle","2026-01-01","2026-01-01");
assert.equal(db.prepare("SELECT user_id FROM user_private_bottles WHERE id=?").get("private-owner-1-a").user_id,"owner-1");
db.prepare("DELETE FROM users WHERE id=?").run("owner-1");
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM user_private_bottles WHERE user_id='owner-1'").get().count,0);
db.close();

console.log(JSON.stringify({ok:true,migration:"v72",owner_scoped:true,account_delete_cascade:true},null,2));
