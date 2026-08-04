import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const root = path.resolve(import.meta.dirname, "..");
const workerSource = fs.readFileSync(path.join(root, "agent", "worker.js"), "utf8");
const catalogSource = fs.readFileSync(path.join(root, "db", "catalog", "scan-index.json"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "db", "catalog", "popular-200.json"), "utf8"));
const generated = JSON.parse(fs.readFileSync(path.join(root, "db", "catalog", "popular-200-catalog.json"), "utf8"));

let source = workerSource.replace("export default {", "globalThis.__worker={");
source += "\nglobalThis.__popularTest={applyScanCatalogOverrides,matchBottleWithVisual};";
const context = {
  console, fetch, Response, Request, Headers, URL, TextEncoder, TextDecoder, Blob,
  crypto: webcrypto, atob, btoa, setTimeout, clearTimeout
};
vm.runInNewContext(source, context, { filename: "worker.js" });

const scanner = context.__popularTest;
const db = scanner.applyScanCatalogOverrides(JSON.parse(catalogSource));
const expectedByName = new Map();
for (const record of generated.bottles) {
  expectedByName.set(record.name, record);
  for (const alias of record.aliases || []) expectedByName.set(alias, record);
}
const rows = [...manifest.bourbon, ...manifest.whisky];
const failures = [];
const aliasFailures = [];

for (const item of rows) {
  const expected = expectedByName.get(item.name);
  const result = scanner.matchBottleWithVisual(db, { name: item.name, confidence: 0.99, candidates: [] });
  const actual = result?.bottle?.id || null;
  if (!expected || actual !== expected.id || result.ambiguous || result.dbConfidence < 0.9) {
    failures.push({
      name: item.name,
      expected: expected?.id || null,
      actual,
      confidence: result?.dbConfidence || 0,
      ambiguous: !!result?.ambiguous,
      candidates: (result?.candidates || []).slice(0, 2).map((candidate) => candidate.name)
    });
  }

  const alias = item.aliases?.[0];
  if (alias) {
    const aliasResult = scanner.matchBottleWithVisual(db, { name: alias, confidence: 0.99, candidates: [] });
    if (aliasResult?.bottle?.id !== expected?.id) {
      aliasFailures.push({ name: item.name, alias, actual: aliasResult?.bottle?.name || null });
    }
  }
}

if (failures.length) {
  throw new Error(`Popular 200 canonical failures (${failures.length}): ${JSON.stringify(failures.slice(0, 20))}`);
}

const aliasTotal = rows.filter((item) => item.aliases?.length).length;
const aliasPassed = aliasTotal - aliasFailures.length;
const aliasRate = aliasTotal ? aliasPassed / aliasTotal : 1;
if (aliasRate < 0.95) {
  throw new Error(`Popular alias top-1 ${(aliasRate * 100).toFixed(1)}%; failures=${JSON.stringify(aliasFailures.slice(0, 20))}`);
}

console.log(JSON.stringify({
  version: manifest.version,
  canonical: { passed: rows.length, total: rows.length, rate: "100.0%" },
  primary_aliases: { passed: aliasPassed, total: aliasTotal, rate: `${(aliasRate * 100).toFixed(1)}%` }
}, null, 2));
