import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const worker = readFileSync(resolve(root, "agent/worker.js"), "utf8");
const schema = readFileSync(resolve(root, "agent/d1-schema.sql"), "utf8");
const migration = readFileSync(resolve(root, "agent/d1-migration-v69-auth-hardening.sql"), "utf8");
const frontend = readFileSync(resolve(root, "index.html"), "utf8");
const readme = readFileSync(resolve(root, "README.md"), "utf8");

function section(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `Missing section start: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `Missing section end: ${end}`);
  return source.slice(from, to);
}

const admin = section(worker, "function isAdminUser", "function constantTimeHexEqual");
assert.match(admin, /is_admin/);
assert.doesNotMatch(admin, /ADMIN_EMAILS|SUPPORT_EMAIL|supportEmail/);

const registration = section(worker, 'if(path==="/auth/register"', 'if(path==="/auth/email-verification/resend"');
assert.match(registration, /createEmailVerification/);
assert.match(registration, /email_verified_at/);
assert.doesNotMatch(registration, /createSession/);

const googleLogin = section(worker, "async function googleUserLogin", "function reportDays");
assert.match(googleLogin, /google_account_exists_unlinked/);
assert.doesNotMatch(googleLogin, /row=await env\.DB\.prepare\("SELECT \* FROM users WHERE email=\?"\)/);
assert.match(worker, /async function completeGoogleLink/);
assert.match(worker, /auth_link_requests/);

assert.match(worker, /email_not_verified/);
assert.match(worker, /accountDeletionReauth/);
assert.match(worker, /constantTimeHexEqual\(hash,row\.password_hash\)/);
assert.match(worker, /auth-verified-email-roles-google-v4/);

for (const sql of [schema, migration]) {
  assert.match(sql, /email_verified_at/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS user_roles/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS email_verification_tokens/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS auth_link_requests/);
}

assert.match(frontend, /handleEmailVerificationFromUrl/);
assert.match(frontend, /data-profile-action="link-google"/);
assert.match(frontend, /deletePasswordPrompt/);
assert.doesNotMatch(readme, /^## Popular 200$/m);

console.log(JSON.stringify({
  ok: true,
  auth_version: "auth-verified-email-roles-google-v4",
  checks: [
    "database_roles_only",
    "verified_email_before_session",
    "no_implicit_google_email_link",
    "one_time_explicit_google_link",
    "account_deletion_reauth",
    "popular_200_removed_from_readme"
  ]
}, null, 2));
