import fs from "node:fs";
import path from "node:path";
import { dedupeCatalogRecords } from "./catalog_identity.mjs";
import { MAX_RETAIL_USD, RETAIL_FILTER_VERSION, retailRemovalReason } from "./catalog_retail_policy.mjs";

const root = path.resolve(import.meta.dirname, "..");
const catalogPath = path.join(root, "db", "catalog", "bottles.json");
const scanPath = path.join(root, "db", "catalog", "scan-index.json");
const reportPath = path.join(root, "db", "catalog", "quality-report.json");
const retailReportPath = path.join(root, "db", "catalog", "retail-filter-report.json");

function fail(message) {
  throw new Error(message);
}

function requiredProfile(record) {
  for (const language of ["en", "pl"]) {
    for (const field of ["general", "nose", "taste", "finish"]) {
      if (!String(record.profile?.[language]?.[field] || "").trim()) return `${record.id}: missing profile.${language}.${field}`;
    }
  }
  return null;
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const scan = JSON.parse(fs.readFileSync(scanPath, "utf8"));
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const retailReport = JSON.parse(fs.readFileSync(retailReportPath, "utf8"));

if (catalog.count !== catalog.bottles.length) fail(`catalog metadata count ${catalog.count} differs from ${catalog.bottles.length} records`);
if (scan.count !== scan.bottles.length) fail(`scan metadata count ${scan.count} differs from ${scan.bottles.length} records`);
if (catalog.bottles.length < 9000) fail(`catalog unexpectedly small: ${catalog.bottles.length}`);
if (scan.bottles.length !== catalog.bottles.length) fail(`scan index count ${scan.bottles.length} differs from catalog ${catalog.bottles.length}`);
if (!scan.token_index || Object.keys(scan.token_index).length < 1000) fail("scan token index is missing or unexpectedly small");
if (report.count !== catalog.bottles.length) fail(`quality report count ${report.count} differs from catalog ${catalog.bottles.length}`);
if (catalog.retail_filter_version !== RETAIL_FILTER_VERSION) fail(`unexpected retail filter: ${catalog.retail_filter_version || "missing"}`);
if (catalog.retail_max_usd !== MAX_RETAIL_USD) fail(`unexpected retail USD limit: ${catalog.retail_max_usd}`);
if (retailReport.after !== catalog.bottles.length) fail(`retail report count ${retailReport.after} differs from catalog ${catalog.bottles.length}`);

const ids = new Set();
const scanIds = new Set(scan.bottles.map((record) => record.id));
for (const record of catalog.bottles) {
  if (!record.id || !record.name || !record.type || !record.category || !record.source) fail(`${record.id || "unknown"}: missing identity field`);
  if (ids.has(record.id)) fail(`duplicate id: ${record.id}`);
  ids.add(record.id);
  if (!scanIds.has(record.id)) fail(`missing in scan index: ${record.id}`);
  const profileError = requiredProfile(record);
  if (profileError) fail(profileError);
  if (!record.profile.basis || !record.profile.confidence) fail(`${record.id}: profile provenance missing`);
  if (record.price_status === "verified") {
    const price = Number(record.price);
    if (!Number.isFinite(price) || price <= 0) fail(`${record.id}: invalid verified price`);
    if (record.price_currency === "USD" && price > 350) fail(`${record.id}: USD price exceeds limit`);
    if (record.price_currency === "PLN" && price > 1000) fail(`${record.id}: PLN price exceeds limit`);
  }
}

const suspicious = catalog.bottles.filter((record) => /Ã|Â|â€|ï¿½|�/.test(JSON.stringify(record)));
if (suspicious.length) fail(`encoding problems in ${suspicious.length} records; first: ${suspicious[0].id}`);

const remainingDuplicates = dedupeCatalogRecords(catalog.bottles);
if (remainingDuplicates.removed) fail(`${remainingDuplicates.removed} safe duplicate records remain`);

const retailViolation = catalog.bottles.find((record) => retailRemovalReason(record));
if (retailViolation) fail(`${retailViolation.id}: violates retail policy (${retailRemovalReason(retailViolation)})`);

const redirects = catalog.id_redirects || {};
for (const [sourceId, targetId] of Object.entries(redirects)) {
  if (sourceId === targetId) fail(`self redirect: ${sourceId}`);
  if (ids.has(sourceId)) fail(`redirect source still exists as canonical record: ${sourceId}`);
  if (!ids.has(targetId)) fail(`redirect target is missing: ${sourceId} -> ${targetId}`);
}

const easyOcrBottle = catalog.bottles.find((record) => record.name === "BULLEIT BOTTLED IN BOND");
if (!easyOcrBottle) fail("easy OCR fixture is missing: BULLEIT BOTTLED IN BOND");
if (easyOcrBottle.category !== "Bottled in Bond" || easyOcrBottle.proof !== 100 || easyOcrBottle.abv !== 50) {
  fail("easy OCR fixture has incorrect category/proof/ABV");
}

console.log(JSON.stringify({
  ok: true,
  count: catalog.bottles.length,
  scan_count: scan.bottles.length,
  dedupe_version: catalog.dedupe_version || null,
  duplicate_records_removed: catalog.duplicate_records_removed || 0,
  retail_filter_version: catalog.retail_filter_version || null,
  retail_records_removed: catalog.retail_records_removed || 0,
  redirects: Object.keys(redirects).length,
  token_count: Object.keys(scan.token_index).length,
  verified_price: report.selected_verified_price,
  recognition_only: report.selected_recognition_only,
  easy_ocr_fixture: easyOcrBottle.id,
  max_usd: Math.max(...catalog.bottles.filter((record) => record.price_currency === "USD").map((record) => Number(record.price) || 0)),
  max_pln: Math.max(...catalog.bottles.filter((record) => record.price_currency === "PLN").map((record) => Number(record.price) || 0))
}, null, 2));
