import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { retailPackagingBundleReason, retailRemovalReason } from "./catalog_retail_policy.mjs";

const require = createRequire(import.meta.url);
const taxonomy = require("../spirit-taxonomy.js");
const root = path.resolve(import.meta.dirname, "..");
const base = JSON.parse(fs.readFileSync(path.join(root, "db", "bourbons.json"), "utf8"));
const browse = JSON.parse(fs.readFileSync(path.join(root, "db", "catalog", "browse-whisky.json"), "utf8"));
const meta = JSON.parse(fs.readFileSync(path.join(root, "db", "catalog", "browse-meta.json"), "utf8"));
const records = [...new Map([...base.bottles, ...browse.bottles].map((record) => [record.id, record])).values()];

assert.equal(new Set(records.map((record) => record.id)).size, records.length, "Browsable IDs must be unique");
assert.ok(records.every((record) => !retailRemovalReason(record)), "Browsable data contains a retail-policy violation");
assert.ok(records.every((record) => !retailPackagingBundleReason(record)), "Browsable data contains a gift/accessory bundle");
assert.ok(base.bottles.every((record) => taxonomy.family(record) === "bourbon" || taxonomy.family(record) === "whisky"));
assert.ok(browse.bottles.every((record) => taxonomy.family(record) === "whisky"), "Bourbon leaked into Whisky browse data");
assert.ok(browse.bottles.every((record) => taxonomy.styleKeys(record).length === 1), "Whisky record has an ambiguous style");

const counts = taxonomy.counts(records);
assert.deepEqual(meta.families, counts.families, "Family counters differ from browsable data");
assert.deepEqual(meta.bourbon, counts.bourbon, "Bourbon counters differ from browsable data");
assert.deepEqual(meta.whisky, counts.whisky, "Whisky counters differ from browsable data");

const explicitContradictions = records.filter((record) => {
  const text = taxonomy.normalize(`${record.name} ${(record.aliases || []).join(" ")} ${record.type || ""} ${record.category || ""} ${record.region || ""}`);
  const family = taxonomy.family(record);
  if (family === "bourbon") {
    return /\b(scotch|irish|japanese|canadian|tennessee|rye whisk(?:e)?y|wheat whisk(?:e)?y|single malt)\b/.test(text);
  }
  return family === "whisky" &&
    /\bbourbon\b/.test(text) &&
    !/\b(?:rye|blend(?:ed)?|tennessee|scotch|irish|japanese|canadian|malt|wheat|corn|apple|honey|peach|pineapple|orange|blackberry|cherry|peanut butter|salted caramel|vanilla|chocolate)\b/.test(text);
});
assert.equal(explicitContradictions.length, 0, `Contradictory categories: ${explicitContradictions.slice(0, 5).map((r) => r.name).join(", ")}`);

console.log(JSON.stringify({
  ok: true,
  taxonomy_version: taxonomy.version,
  browsable: records.length,
  families: counts.families,
  bourbon: counts.bourbon,
  whisky: counts.whisky
}, null, 2));
