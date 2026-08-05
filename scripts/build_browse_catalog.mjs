import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { catalogProductIdentityKey } from "./catalog_identity.mjs";

const require = createRequire(import.meta.url);
const taxonomy = require("../spirit-taxonomy.js");
const root = path.resolve(import.meta.dirname, "..");
const sourcePath = path.join(root, "db", "catalog", "bottles.json");
const basePath = path.join(root, "db", "bourbons.json");
const manualPath = path.join(root, "db", "catalog", "manual-popular-whisky.json");
const outputPath = path.join(root, "db", "catalog", "browse-whisky.json");
const metaPath = path.join(root, "db", "catalog", "browse-meta.json");

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const base = JSON.parse(fs.readFileSync(basePath, "utf8"));
const manual = fs.existsSync(manualPath) ? JSON.parse(fs.readFileSync(manualPath, "utf8")) : { bottles: [] };
const all = Array.isArray(source.bottles) ? source.bottles : [];
const baseRecords = Array.isArray(base.bottles) ? base.bottles : [];
const manualRecords = Array.isArray(manual.bottles) ? manual.bottles : [];
const whiskyById = new Map();
[...baseRecords, ...manualRecords, ...all]
  .filter((bottle) => taxonomy.family(bottle) === "whisky" && taxonomy.isVisibleBottle(bottle))
  .forEach((bottle) => whiskyById.set(bottle.id, {
    id: bottle.id,
    name: bottle.name,
    aliases: bottle.aliases,
    distillery: bottle.distillery,
    region: bottle.region,
    type: bottle.type,
    category: bottle.category,
    proof: bottle.proof,
    abv: bottle.abv,
    mashbill: bottle.mashbill,
    price: bottle.price,
    price_str: bottle.price_str,
    price_pln: bottle.price_pln,
    quality: bottle.quality,
    value: bottle.value,
    notes: bottle.notes,
    desc: bottle.desc,
    image: bottle.image && fs.existsSync(path.join(root, bottle.image)) ? bottle.image : "",
    source: bottle.source,
    catalog_status: bottle.catalog_status,
    spirit_family: "whisky",
    browse_style: taxonomy.whiskyStyle(bottle)
  }));
function browseScore(record) {
  const specific = !["american_other", "other_whisky"].includes(record.browse_style);
  return (record.image ? 8 : 0) + (specific ? 4 : 0) + (record.region ? 2 : 0) + (record.distillery ? 1 : 0);
}
const whiskyByProduct = new Map();
for (const record of whiskyById.values()) {
  const key = catalogProductIdentityKey(record.name) || record.id;
  const existing = whiskyByProduct.get(key);
  if (!existing || browseScore(record) > browseScore(existing)) whiskyByProduct.set(key, record);
}
const whisky = [...whiskyByProduct.values()];

const catalogCounts = taxonomy.counts([
  ...baseRecords.filter((bottle) => taxonomy.family(bottle) === "bourbon"),
  ...whisky
]);
const browseCounts = taxonomy.counts(whisky);
const updated = new Date().toISOString();
const common = {
  version: "browse-whisky-v1",
  taxonomy_version: taxonomy.version,
  source_version: source.version || "",
  updated
};

fs.writeFileSync(outputPath, `${JSON.stringify({ ...common, count: whisky.length, counts: browseCounts.whisky, bottles: whisky })}\n`);
fs.writeFileSync(metaPath, `${JSON.stringify({
  ...common,
  count: catalogCounts.families.bourbon + catalogCounts.families.whisky,
  source_count: all.length + manualRecords.length,
  families: catalogCounts.families,
  bourbon: catalogCounts.bourbon,
  whisky: catalogCounts.whisky
}, null, 2)}\n`);

process.stdout.write(`Browse catalog: ${whisky.length} whisky records\n`);
process.stdout.write(`${JSON.stringify(catalogCounts, null, 2)}\n`);
