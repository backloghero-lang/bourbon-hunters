import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";

const root=new URL("../",import.meta.url);
const worker=readFileSync(new URL("agent/worker.js",root),"utf8");
const frontend=readFileSync(new URL("index.html",root),"utf8");
const migration=readFileSync(new URL("agent/d1-migration-v75-data-minimization.sql",root),"utf8");
const readme=readFileSync(new URL("README.md",root),"utf8");

assert.doesNotMatch(frontend,/[?&]bhdev|localStorage\.setItem\(["']bh_dev/);
assert.match(frontend,/localStorage\.removeItem\("bh_dev"\)/);
assert.doesNotMatch(worker,/env\.DEV_KEY/);
assert.match(worker,/function contributorHashFor/);
assert.match(worker,/CATALOG_HASH_SECRET/);
assert.match(worker,/path==="\/me\/export"/);
assert.match(worker,/path==="\/me\/age-confirmation"/);
assert.match(worker,/code_challenge_method","S256"/);
assert.match(worker,/code_verifier/);
assert.match(worker,/constantTimeHexEqual\(expected,parts\[1\]\)/);
assert.match(worker,/consumed&&consumed\.meta&&consumed\.meta\.changes/);
assert.match(worker,/moderation_operation_in_progress/);
assert.match(worker,/candidate\.origin===base\.origin && candidate\.pathname===base\.pathname/);
assert.match(frontend,/function exportProfileData/);
assert.match(frontend,/AUTH_USER\.age_verified===true/);
assert.doesNotMatch(frontend,/user-scalable=no|maximum-scale=1/);
assert.match(frontend,/prefers-reduced-motion:reduce/);
assert.doesNotMatch(frontend,/id="bhIntro"[^>]*aria-hidden="true"/);
assert.doesNotMatch(frontend,/fonts\.googleapis\.com|fonts\.gstatic\.com/);
assert.match(frontend,/assets\/fonts\/manrope-400\.ttf/);
assert.match(worker,/configured\.split\(","\)\.map\(corsOrigin\)\.filter/);
assert.match(worker,/allowed\.indexOf\(requestOrigin\)>=0\?requestOrigin:""/);
assert.match(readme,/^## Bezpieczeństwo$/m);

const db=new DatabaseSync(":memory:");
db.exec(`CREATE TABLE users (
  id TEXT PRIMARY KEY, password_algo TEXT, birth_date TEXT,
  age_gate_country TEXT, age_verified_at TEXT, updated_at TEXT
);`);
db.exec(`INSERT INTO users VALUES
  ('local','pbkdf2-sha256-600000','1990-01-01','global','2026-01-01','2026-01-01'),
  ('google','google-oauth2',NULL,'google','2026-01-01','2026-01-01');`);
db.exec(migration);
assert.equal(db.prepare("SELECT birth_date FROM users WHERE id='local'").get().birth_date,null);
assert.equal(db.prepare("SELECT age_verified_at FROM users WHERE id='google'").get().age_verified_at,null);
db.exec("UPDATE users SET age_verified_at='2026-02-01',age_gate_country='global' WHERE id='google'");
db.exec(migration);
assert.equal(db.prepare("SELECT age_verified_at FROM users WHERE id='google'").get().age_verified_at,"2026-02-01");
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='google_oauth_requests'").get().count,1);
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='storage_operations'").get().count,1);
db.close();

console.log(JSON.stringify({ok:true,checks:["dev_key_removed","exact_cors","hmac_pseudonymization","data_export","age_minimization","local_fonts","wcag_zoom_motion_intro"]},null,2));
