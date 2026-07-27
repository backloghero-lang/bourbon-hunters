import fs from "node:fs";
import path from "node:path";
import { consolidateCatalogProducts, dedupeCatalogRecords } from "./catalog_identity.mjs";
import {
  catalogQualityRemovalReason,
  MAX_RETAIL_PLN,
  MAX_RETAIL_USD,
  RETAIL_FILTER_VERSION,
  retailPackagingBundleReason,
  retailPricePln,
  retailPriceUsd,
  retailRemovalReason
} from "./catalog_retail_policy.mjs";

const root = path.resolve(import.meta.dirname, "..");
const catalogPath = path.join(root, "db", "catalog", "bottles.json");
const scanPath = path.join(root, "db", "catalog", "scan-index.json");
const reportPath = path.join(root, "db", "catalog", "quality-report.json");
const retailReportPath = path.join(root, "db", "catalog", "retail-filter-report.json");
const imageReportPath = path.join(root, "db", "catalog", "image-quality-report.json");

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
const imageReport = JSON.parse(fs.readFileSync(imageReportPath, "utf8"));
const base = JSON.parse(fs.readFileSync(path.join(root, "db", "bourbons.json"), "utf8"));

if (catalog.count !== catalog.bottles.length) fail(`catalog metadata count ${catalog.count} differs from ${catalog.bottles.length} records`);
if (scan.count !== scan.bottles.length) fail(`scan metadata count ${scan.count} differs from ${scan.bottles.length} records`);
if (catalog.bottles.length < 750) fail(`quality catalog unexpectedly small: ${catalog.bottles.length}`);
if (scan.bottles.length !== catalog.bottles.length) fail(`scan index count ${scan.bottles.length} differs from catalog ${catalog.bottles.length}`);
if (!scan.token_index || Object.keys(scan.token_index).length < 500) fail("scan token index is missing or unexpectedly small");
if (report.count !== catalog.bottles.length) fail(`quality report count ${report.count} differs from catalog ${catalog.bottles.length}`);
if (catalog.retail_filter_version !== RETAIL_FILTER_VERSION) fail(`unexpected retail filter: ${catalog.retail_filter_version || "missing"}`);
if (catalog.retail_max_usd !== MAX_RETAIL_USD) fail(`unexpected retail USD limit: ${catalog.retail_max_usd}`);
if (catalog.retail_max_pln !== MAX_RETAIL_PLN) fail(`unexpected retail PLN limit: ${catalog.retail_max_pln}`);
if (retailReport.after !== catalog.bottles.length) fail(`retail report count ${retailReport.after} differs from catalog ${catalog.bottles.length}`);
if (!imageReport.applied || imageReport.accepted < 100) fail("bottle image quality pipeline was not applied");
if (base.image_quality_version !== imageReport.asset_quality_version) fail("base image quality version differs from image report");

if (base.count !== base.bottles.length) fail(`base metadata count ${base.count} differs from ${base.bottles.length} records`);
for (const record of base.bottles) {
  const retailReason = retailRemovalReason(record);
  if (retailReason) fail(`${record.id}: base retail policy violation (${retailReason})`);
  if (retailPriceUsd(record) > MAX_RETAIL_USD) fail(`${record.id}: base USD price exceeds limit`);
  if (retailPricePln(record) > MAX_RETAIL_PLN) fail(`${record.id}: base PLN price exceeds limit`);
  if (!record.image) continue;
  if (!/^assets\/bourbons\/clean\/.+\.webp$/i.test(record.image)) fail(`${record.id}: active bottle image is not a clean asset`);
  if (!fs.existsSync(path.join(root, ...record.image.split("/")))) fail(`${record.id}: clean bottle image is missing`);
  if (record.source === "domwhisky") fail(`${record.id}: watermarked retailer image is still active`);
}

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
  const retailReason = retailRemovalReason(record);
  if (retailReason) fail(`${record.id}: retail policy violation (${retailReason})`);
  const qualityReason = catalogQualityRemovalReason(record);
  if (qualityReason) fail(`${record.id}: catalog quality violation (${qualityReason})`);
  if (retailPriceUsd(record) > MAX_RETAIL_USD) fail(`${record.id}: normalized USD price exceeds limit`);
  if (retailPricePln(record) > MAX_RETAIL_PLN) fail(`${record.id}: normalized PLN price exceeds limit`);
  if (record.price_status === "verified") {
    const price = Number(record.price);
    if (!Number.isFinite(price) || price <= 0) fail(`${record.id}: invalid verified price`);
    if (record.price_currency === "USD" && price > MAX_RETAIL_USD) fail(`${record.id}: USD price exceeds limit`);
    if (record.price_currency === "PLN" && price > MAX_RETAIL_PLN) fail(`${record.id}: PLN price exceeds limit`);
  }
}

const suspicious = catalog.bottles.filter((record) => /Ã|Â|â€|ï¿½|�/.test(JSON.stringify(record)));
if (suspicious.length) fail(`encoding problems in ${suspicious.length} records; first: ${suspicious[0].id}`);

const remainingDuplicates = dedupeCatalogRecords(catalog.bottles);
if (remainingDuplicates.removed) fail(`${remainingDuplicates.removed} safe duplicate records remain`);
if (remainingDuplicates.renamed) fail(`${remainingDuplicates.renamed} catalog names are not canonical`);
const remainingProductDuplicates = consolidateCatalogProducts(catalog.bottles, catalog.id_redirects || {});
if (remainingProductDuplicates.removed) fail(`${remainingProductDuplicates.removed} product-level duplicate records remain`);

const michters10=base.bottles.filter((record)=>/michter.*10.*year/i.test(record.name));
if(michters10.length!==1 || michters10[0].name!=="Michter's 10 Year Single Barrel"){
  fail(`Michter's 10 Year is not canonical: ${michters10.map((record)=>record.name).join(", ")}`);
}
const knobSingleBarrel=base.bottles.filter((record)=>/knob creek.*(?:single barrel|sdbb|bold pick)/i.test(record.name));
if(knobSingleBarrel.length!==1 || knobSingleBarrel[0].id!=="knob-creek-120-proof-9-year-single-barrel-reserve-bourbon"){
  fail(`Knob Creek Single Barrel is not canonical: ${knobSingleBarrel.map((record)=>record.name).join(", ")}`);
}
const jackBonded=catalog.bottles.filter((record)=>/jack daniel.*bonded/i.test([record.name,...(record.aliases||[])].join(" ")));
const jackBondedStandard=jackBonded.find((record)=>record.id==="jack-daniel-s-bonded-119-43");
const jackBondedRye=jackBonded.find((record)=>/\bbonded rye\b/i.test([record.name,...(record.aliases||[])].join(" ")));
if(!jackBondedStandard||!jackBondedRye||jackBondedStandard.id===jackBondedRye.id){
  fail("Jack Daniel's Bonded and Bonded Rye are not separate canonical products");
}
const nonCanonicalDisplay=[...base.bottles,...catalog.bottles].find((record)=>
  /\s+(?:kentucky\s+)?(?:straight\s+)?bourbon\s+(?:whisky|whiskey)\s*$/i.test(record.name)
);
if(nonCanonicalDisplay) fail(`${nonCanonicalDisplay.id}: category suffix remains in display name`);
if(base.bottles.some((record)=>retailRemovalReason(record))) fail("browse database still contains a retail-policy violation");
if(base.bottles.some((record)=>(record.aliases||[]).some((name)=>retailPackagingBundleReason({name})))){
  fail("browse database still contains a gift/accessory alias");
}

const retailViolation = catalog.bottles.find((record) => retailRemovalReason(record));
if (retailViolation) fail(`${retailViolation.id}: violates retail policy (${retailRemovalReason(retailViolation)})`);
const packagingAlias = catalog.bottles.find((record)=>(record.aliases||[]).some((name)=>retailPackagingBundleReason({name})));
if(packagingAlias) fail(`${packagingAlias.id}: contains a gift/accessory alias`);

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
  retail_records_removed: retailReport.removed || 0,
  redirects: Object.keys(redirects).length,
  browse_count: base.bottles.length,
  token_count: Object.keys(scan.token_index).length,
  verified_price: report.selected_verified_price,
  recognition_only: report.selected_recognition_only,
  easy_ocr_fixture: easyOcrBottle.id,
  max_usd: Math.max(...catalog.bottles.filter((record) => record.price_currency === "USD").map((record) => Number(record.price) || 0)),
  max_pln: Math.max(0, ...catalog.bottles.filter((record) => record.price_currency === "PLN").map((record) => Number(record.price) || 0))
}, null, 2));
