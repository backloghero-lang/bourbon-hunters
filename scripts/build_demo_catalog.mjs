import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  catalogProductIdentityKey,
  catalogRecordsCompatible,
  identityAscii
} from "./catalog_identity.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const popularPath = path.join(root, "db", "catalog", "popular-200-catalog.json");
const basePath = path.join(root, "db", "bourbons.json");
const catalogPath = path.join(root, "db", "catalog", "bottles.json");
const demoPath = path.join(root, "db", "catalog", "demo-200.json");
const scanPath = path.join(root, "db", "catalog", "demo-scan-index.json");
const manifestPath = path.join(root, "db", "catalog", "demo-image-manifest.json");
const reportPath = path.join(root, "db", "catalog", "demo-build-report.json");
const overridesPath = path.join(root, "db", "catalog", "demo-image-overrides.json");
const imageReviewPath = path.join(root, "db", "catalog", "demo-image-review.json");

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const toPosix = (value) => value.split(path.sep).join("/");
const existsInRepo = (relative) => !!relative && fs.existsSync(path.join(root, relative));

function imageRank(relative) {
  const value = toPosix(relative).toLowerCase();
  if (value.includes("/clean/")) return 500;
  if (value.includes("/runtime-100/")) return 400;
  if (value.includes("/cutouts-test/")) return 300;
  if (value.includes("/list-thumbs/")) return 100;
  return 200;
}

function walkImages(directory) {
  if (!fs.existsSync(directory)) return [];
  const out = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...walkImages(absolute));
    else if (/\.(?:png|webp|jpe?g)$/i.test(entry.name)) out.push(toPosix(path.relative(root, absolute)));
  }
  return out;
}

function recordNames(record) {
  return [record?.name, ...(Array.isArray(record?.aliases) ? record.aliases : [])]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function exactNameKeys(record) {
  return new Set(recordNames(record).map(identityAscii).filter(Boolean));
}

function assetName(relative) {
  return path.basename(relative, path.extname(relative));
}

function compatibleImageRecords(target, records) {
  const targetKey = catalogProductIdentityKey(target.name);
  return records.filter((candidate) => {
    if (!candidate?.image || !existsInRepo(candidate.image)) return false;
    if (candidate.id === target.id) return true;
    if (!targetKey || catalogProductIdentityKey(candidate.name) !== targetKey) return false;
    return catalogRecordsCompatible(target, candidate);
  });
}

function resolveExistingImage(target, records, assets) {
  const inherited = compatibleImageRecords(target, records)
    .sort((left, right) => imageRank(right.image) - imageRank(left.image));
  if (inherited.length) {
    return { image: inherited[0].image, method: inherited[0].id === target.id ? "record_id" : "product_identity" };
  }

  const exact = exactNameKeys(target);
  const targetProductKey = catalogProductIdentityKey(target.name);
  const candidates = assets.filter((relative) => {
    const stem = assetName(relative);
    if (exact.has(identityAscii(stem))) return true;
    const assetProductKey = catalogProductIdentityKey(stem);
    return !!targetProductKey && assetProductKey === targetProductKey;
  }).sort((left, right) => imageRank(right) - imageRank(left));

  if (!candidates.length) return null;
  return { image: candidates[0], method: candidates.length === 1 ? "unique_asset_identity" : "ranked_asset_identity" };
}

function scanRecord(record) {
  return {
    id: record.id,
    name: record.name,
    aliases: Array.isArray(record.aliases) ? record.aliases : [],
    distillery: record.distillery || "",
    region: record.region || "",
    type: record.type || "",
    category: record.category || "",
    proof: record.proof ?? null,
    abv: record.abv ?? null,
    mashbill: record.mashbill ?? null,
    price: record.price ?? null,
    price_range: record.price_range ?? "",
    quality: record.quality ?? null,
    value: record.value ?? null,
    notes: record.notes || "",
    desc: record.desc || record.description || "",
    nose: record.nose || "",
    taste: record.taste || "",
    finish: record.finish || "",
    image: record.image,
    source: "demo_200",
    catalog_status: "demo"
  };
}

const popular = readJson(popularPath);
const base = readJson(basePath);
const catalog = readJson(catalogPath);
const imageOverrides = fs.existsSync(overridesPath) ? readJson(overridesPath).items || {} : {};
const rejectedImageIds = fs.existsSync(imageReviewPath)
  ? new Set(Object.keys(readJson(imageReviewPath).rejected || {}))
  : new Set();
const sourceRecords = [...(base.bottles || []), ...(catalog.bottles || [])];
const assets = walkImages(path.join(root, "assets", "bourbons"));
const now = new Date().toISOString();
const methods = {};

const bottles = (popular.bottles || []).slice(0, 200).map((record, index) => {
  let resolution = null;
  const override=rejectedImageIds.has(record.id) ? null : imageOverrides[record.id];
  if (override?.image && existsInRepo(override.image)) resolution = { image: override.image, method: "official_source_override", override };
  else if (record.image && existsInRepo(record.image)) resolution = { image: record.image, method: "popular_record" };
  else resolution = resolveExistingImage(record, sourceRecords, assets);
  if (resolution) methods[resolution.method] = (methods[resolution.method] || 0) + 1;
  return {
    ...record,
    demo_rank: index + 1,
    demo_public: true,
    demo_image_status: resolution ? "ready" : "missing",
    image: resolution?.image || "",
    image_provenance: resolution ? {
      status: "existing_repository_asset",
      method: resolution.method,
      source_url: resolution.override?.source_url || record.image_source || "",
      source_page: resolution.override?.source_page || "",
      license_status: resolution.override?.license_status || record.image_license || "existing_project_asset"
    } : {
      status: "source_required",
      method: "none",
      source_url: "",
      source_page: "",
      license_status: "pending"
    }
  };
});

const scannerBottles = bottles.map(scanRecord);
const manifest = bottles.map((record) => ({
  rank: record.demo_rank,
  id: record.id,
  name: record.name,
  family: record.family || "",
  image: record.image || "",
  status: record.demo_image_status,
  source_url: record.image_provenance.source_url || "",
  source_page: record.image_provenance.source_page || "",
  license_status: record.image_provenance.license_status,
  notes: record.demo_image_status === "ready" ? "" : "Add a licensed manufacturer, distributor or owner-provided bottle image."
}));

const report = {
  ok: true,
  version: "demo-200-v1",
  updated: now,
  requested: 200,
  public_records: bottles.length,
  scanner_records: scannerBottles.length,
  missing_images: bottles.filter((record) => record.demo_image_status !== "ready").length,
  resolution_methods: methods
};

fs.writeFileSync(demoPath, JSON.stringify({ version: report.version, updated: now, count: bottles.length, bottles }, null, 2) + "\n");
fs.writeFileSync(scanPath, JSON.stringify({ version: report.version, updated: now, count: scannerBottles.length, bottles: scannerBottles }, null, 2) + "\n");
fs.writeFileSync(manifestPath, JSON.stringify({ version: report.version, updated: now, count: manifest.length, items: manifest }, null, 2) + "\n");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
