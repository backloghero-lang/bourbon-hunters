import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const overridesPath = path.join(root, "db", "catalog", "demo-image-overrides.json");
const reviewPath = path.join(root, "db", "catalog", "demo-image-review.json");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const overrides = readJson(overridesPath);
const review = readJson(reviewPath);
const rejected = new Set(Object.keys(review.rejected || {}));
const removed = [];

for (const id of rejected) {
  const item = overrides.items?.[id];
  if (!item) continue;
  const absolute = path.resolve(root, item.image || "");
  const allowedRoot = path.join(root, "assets", "bourbons", "demo-200") + path.sep;
  if (absolute.startsWith(allowedRoot) && fs.existsSync(absolute)) fs.unlinkSync(absolute);
  delete overrides.items[id];
  removed.push({ id, image: item.image });
}

overrides.updated = new Date().toISOString();
fs.writeFileSync(overridesPath, JSON.stringify(overrides, null, 2) + "\n");
process.stdout.write(JSON.stringify({ ok: true, removed_count: removed.length, removed }, null, 2) + "\n");
