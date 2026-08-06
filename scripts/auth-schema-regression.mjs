import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migration = readFileSync(resolve(root, "agent/d1-migration-v69-auth-hardening.sql"), "utf8");
const rateMigration = readFileSync(resolve(root, "agent/d1-migration-v71-auth-rate-limits.sql"), "utf8");
const canonicalSchema = readFileSync(resolve(root, "agent/d1-schema.sql"), "utf8");

const canonical = new DatabaseSync(":memory:");
canonical.exec("PRAGMA foreign_keys = ON");
canonical.exec(canonicalSchema);
for (const table of ["users","user_roles","email_verification_tokens","auth_link_requests","auth_rate_events"]) {
  assert.equal(canonical.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name=?").get(table).count,1);
}
canonical.close();

const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON");
db.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_algo TEXT NOT NULL,
    birth_date TEXT,
    age_gate_country TEXT,
    age_gate_min INTEGER,
    age_verified_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    user_agent TEXT,
    ip TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  INSERT INTO users VALUES ('user-1','owner@example.com','owner','hash','salt','pbkdf2','1990-01-01','global',18,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z');
  INSERT INTO sessions VALUES ('session-1','user-1','token','2026-01-01T00:00:00Z','2099-01-01T00:00:00Z','','');
`);
db.exec(migration);
db.exec(rateMigration);

const migrated = db.prepare("SELECT email_verified_at FROM users WHERE id='user-1'").get();
assert.equal(migrated.email_verified_at,"2026-01-01T00:00:00Z");
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM user_roles").get().count,0,"Migration must not infer admin from email");

db.exec(`
  INSERT INTO user_roles (user_id, role, granted_at, granted_by, note)
  SELECT id, 'admin', datetime('now'), 'migration-test', 'Initial administrator'
  FROM users WHERE email = 'owner@example.com'
  ON CONFLICT(user_id, role) DO UPDATE SET revoked_at = NULL;
`);
assert.equal(db.prepare("SELECT role FROM user_roles WHERE user_id='user-1'").get().role,"admin");

db.exec("DELETE FROM sessions WHERE user_id IN (SELECT user_id FROM user_roles WHERE role='admin' AND revoked_at IS NULL)");
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sessions").get().count,0);
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='auth_rate_events'").get().count,1);
db.close();

console.log(JSON.stringify({ok:true,migrations:["v69","v71"],backfill:true,implicit_admin:false,explicit_admin:true,admin_sessions_revoked:true,auth_rate_schema:true},null,2));
