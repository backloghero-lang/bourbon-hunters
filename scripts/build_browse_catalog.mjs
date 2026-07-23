import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const taxonomy = require("../spirit-taxonomy.js");
const root = path.resolve(import.meta.dirname, "..");
const sourcePath = path.join(root, "db", "catalog", "bottles.json");
const outputPath = path.join(root, "db", "catalog", "browse-whisky.json");
const metaPath = path.join(root, "db", "catalog", "browse-meta.json");

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const all = Array.isArray(source.bottles) ? source.bottles : [];
const whisky = all
  .filter((bottle) => taxonomy.family(bottle) === "whisky")
  .map((bottle) => ({
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

const catalogCounts = taxonomy.counts(all);
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
  count: all.length,
  families: catalogCounts.families,
  bourbon: catalogCounts.bourbon,
  whisky: catalogCounts.whisky
}, null, 2)}\n`);

process.stdout.write(`Browse catalog: ${whisky.length} whisky records\n`);
process.stdout.write(`${JSON.stringify(catalogCounts, null, 2)}\n`);
