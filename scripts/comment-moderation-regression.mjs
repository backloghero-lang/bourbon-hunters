import assert from "node:assert/strict";
import fs from "node:fs";

const worker=fs.readFileSync(new URL("../agent/worker.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const migration=fs.readFileSync(new URL("../agent/d1-migration-v74-comment-moderation.sql",import.meta.url),"utf8");

for(const table of ["comment_reports","user_blocks","comment_moderation_actions"]){
  assert.match(migration,new RegExp("CREATE TABLE IF NOT EXISTS "+table));
}
assert.match(migration,/moderation_status/);
assert.match(worker,/UGC_MODERATION_VERSION\s*=\s*"comment-reports-blocks-admin-v1"/);
assert.match(worker,/path==="\/me\/recommendation\/report"/);
assert.match(worker,/path==="\/me\/user-block"/);
assert.match(worker,/path==="\/admin\/comments\/moderation"/);
assert.match(worker,/NOT EXISTS \(SELECT 1 FROM user_blocks/);
assert.match(worker,/report_rate_limited/);
assert.match(worker,/body&&body\.recommendation_id/);
assert.match(html,/data-report-comment/);
assert.match(html,/data-block-recommendation/);
assert.match(html,/adminCommentModerationBody/);
const publicRecommendationMapper=worker.slice(worker.indexOf("return {ready:true,recommendations:"),worker.indexOf("async function upsertRecommendation"));
assert.doesNotMatch(publicRecommendationMapper,/user_id\s*:/,"Public recommendations must not expose the internal user UUID");

console.log("Comment moderation regression passed");
