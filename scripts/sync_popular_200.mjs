import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { buildCatalogTokenIndex, catalogProductDisplayName, dedupeCatalogRecords } from "./catalog_identity.mjs";

const require = createRequire(import.meta.url);
const taxonomy = require("../spirit-taxonomy.js");
const root = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(root, "db", "catalog", "popular-200.json");
const catalogPath = path.join(root, "db", "catalog", "bottles.json");
const scanPath = path.join(root, "db", "catalog", "scan-index.json");
const generatedPath = path.join(root, "db", "catalog", "popular-200-catalog.json");
const reportPath = path.join(root, "db", "catalog", "popular-200-report.json");
const qualityReportPath = path.join(root, "db", "catalog", "quality-report.json");
const retailReportPath = path.join(root, "db", "catalog", "retail-filter-report.json");
const preferredIds = {
  "Jim Beam Single Barrel": "jim-beam-single-barrel",
  "Bushmills Original": "bushmills-original-irish-whiskey",
  "Bushmills Black Bush": "bushmills-black-bush-irish-whiskey",
  "Bushmills 10 Year Old Single Malt": "bushmills-10-year-old-single-malt",
  "Bushmills 12 Year Old Single Malt": "bushmills-12-year-old-single-malt",
  "Bushmills 16 Year Old Single Malt": "bushmills-16-year-old-single-malt"
};

function ascii(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u2018\u2019`]/g, "'")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value) {
  return ascii(value).replace(/ /g, "-");
}

// Label identity keeps variant markers but normalizes retailer shorthand.
function labelKey(value) {
  return ascii(value)
    .replace(/\bd e w\b/g, "dew")
    .replace(/\b(\d{1,2})\s*(?:years? old|years?|yrs?|yo)\b/g, "$1 year")
    .replace(/\bbottled[- ]in[- ]bond\b/g, "bottled in bond")
    .replace(/\bthe\b/g, " ")
    .replace(/\b(?:kentucky\s+)?straight\s+bourbon\s+(?:whisky|whiskey)\b/g, "bourbon")
    .replace(/\b(?:scotch|irish|japanese|canadian)\s+(?:whisky|whiskey)\b/g, " ")
    .replace(/\b(?:whisky|whiskey)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function expandedAliases(item) {
  const source = unique([item.name, ...(item.aliases || [])]);
  const aliases = [...source];
  for (const value of source) {
    aliases.push(value.replace(/^The\s+/i, ""));
    aliases.push(value.replace(/\b(\d{1,2}) Year\b/gi, "$1 Year Old"));
    aliases.push(value.replace(/\b(\d{1,2}) Year\b/gi, "$1 YR"));
    aliases.push(value.replace(/\b(\d{1,2}) Year\b/gi, "$1 YO"));
    aliases.push(value.replace(/Whisky/gi, "Whiskey"));
    aliases.push(value.replace(/Whiskey/gi, "Whisky"));
    aliases.push(value.replace(/[\u2018\u2019']/g, ""));
  }
  return unique(aliases).filter((value) => ascii(value) !== ascii(item.name));
}

function inferredStyle(item, family) {
  if (family === "bourbon") return "bourbon";
  return String(item.style || "world").toLowerCase();
}

function inferredCategory(name, style) {
  const value = ascii(name);
  if (/bottled in bond|\bbonded\b|\bbib\b/.test(value)) return "Bottled-in-Bond";
  if (/single barrel|single cask/.test(value)) return "Single Barrel";
  if (/barrel proof|cask strength|full proof/.test(value)) return "Barrel Proof";
  if (/small batch/.test(value)) return "Small Batch";
  if (/double oak|doublewood|double cask/.test(value)) return "Double Oak/Cask";
  if (style === "scotch") return "Scotch";
  if (style === "irish") return "Irish";
  if (style === "japanese") return "Japanese";
  if (style === "tennessee") return "Tennessee";
  if (style === "rye") return "Rye";
  if (style === "canadian") return "Canadian";
  return "Standard";
}

function inferredRegion(style) {
  return {
    bourbon: "USA",
    scotch: "Scotland",
    irish: "Ireland",
    japanese: "Japan",
    tennessee: "Tennessee",
    rye: "USA",
    canadian: "Canada"
  }[style] || "";
}

function inferredType(style) {
  return {
    bourbon: "Kentucky Straight Bourbon Whiskey",
    scotch: "Scotch Whisky",
    irish: "Irish Whiskey",
    japanese: "Japanese Whisky",
    tennessee: "Tennessee Whiskey",
    rye: "Rye Whiskey",
    canadian: "Canadian Whisky"
  }[style] || "Whisky";
}

function inferredProof(name) {
  const explicit = Number((String(name).match(/\b(\d{2,3}(?:\.\d+)?)\s*Proof\b/i) || [])[1]);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  if (/bottled[- ]in[- ]bond|\bbonded\b|\bbib\b/i.test(name)) return 100;
  return null;
}

function defaultDescription(style) {
  if (style === "bourbon") return "Popularny bourbon wybrany do katalogu rozpoznawania etykiet Bourbon Hunters.";
  if (style === "scotch") return "Popularna szkocka whisky wybrana do katalogu rozpoznawania etykiet Bourbon Hunters.";
  if (style === "irish") return "Popularna irlandzka whiskey wybrana do katalogu rozpoznawania etykiet Bourbon Hunters.";
  if (style === "japanese") return "Popularna japonska whisky wybrana do katalogu rozpoznawania etykiet Bourbon Hunters.";
  return "Popularna whisky wybrana do katalogu rozpoznawania etykiet Bourbon Hunters.";
}

function styleProfile(style, name) {
  const profiles = {
    bourbon: {
      en: ["vanilla, caramel and toasted oak", "caramel sweetness, baking spice and oak", "a warm finish with vanilla, spice and char"],
      pl: ["wanilia, karmel i prazony dab", "karmelowa slodycz, przyprawy korzenne i dab", "cieply finisz z wanilia, przyprawami i opaleniem"]
    },
    scotch: {
      en: ["malt, orchard fruit and gentle oak", "malted grain, fruit and balanced cask spice", "a malty finish with fruit and dry oak"],
      pl: ["slod, owoce sadu i lagodny dab", "slodowe zboze, owoce i zrownowazona przyprawa beczki", "slodowy finisz z owocami i suchym debem"]
    },
    irish: {
      en: ["honey, orchard fruit and soft grain", "smooth grain, vanilla and light fruit", "a clean finish with honey and gentle spice"],
      pl: ["miod, owoce sadu i lagodne zboze", "gladkie zboze, wanilia i lekkie owoce", "czysty finisz z miodem i lagodna przyprawa"]
    },
    japanese: {
      en: ["delicate fruit, floral malt and polished oak", "clean malt, citrus and measured oak", "a precise finish with fruit and soft spice"],
      pl: ["delikatne owoce, kwiatowy slod i wygladzony dab", "czysty slod, cytrusy i umiarkowany dab", "precyzyjny finisz z owocami i lagodna przyprawa"]
    },
    rye: {
      en: ["rye spice, citrus peel and oak", "peppery grain, caramel and herbal spice", "a dry finish with rye spice and oak"],
      pl: ["zytnia przyprawa, skorka cytrusowa i dab", "pieprzne zboze, karmel i ziolowa przyprawa", "wytrawny finisz z zytnia przyprawa i debem"]
    }
  };
  const selected = profiles[style] || profiles.bourbon;
  return {
    basis: "curated_style_estimate",
    confidence: "medium",
    en: {
      general: `${name} is a popular expression included in the Bourbon Hunters label-recognition catalog. The tasting profile is a style estimate, not an official producer note.`,
      nose: selected.en[0], taste: selected.en[1], finish: selected.en[2]
    },
    pl: {
      general: `${name} to popularna pozycja dodana do katalogu rozpoznawania etykiet Bourbon Hunters. Profil smaku jest estymacja stylu, a nie oficjalna nota producenta.`,
      nose: selected.pl[0], taste: selected.pl[1], finish: selected.pl[2]
    }
  };
}

function curatedRecord(item, family) {
  const style = inferredStyle(item, family);
  const proof = inferredProof(item.name);
  const displayName = catalogProductDisplayName(item.name);
  const profile = styleProfile(style, displayName);
  return {
    id: preferredIds[item.name] || `popular-${slug(item.name)}`,
    name: displayName,
    aliases: unique([item.name, ...expandedAliases(item)]).filter((value) => ascii(value) !== ascii(displayName)),
    distillery: "",
    region: inferredRegion(style),
    type: inferredType(style),
    category: inferredCategory(item.name, style),
    proof,
    abv: proof ? proof / 2 : null,
    mashbill: null,
    price: null,
    price_str: null,
    price_pln: null,
    quality: null,
    value: null,
    notes: profile.pl.nose,
    desc: defaultDescription(style),
    profile,
    image: "",
    status: "catalog",
    source: "popular_200_curated",
    source_refs: ["popular-200-2026-v1"],
    catalog_status: "curated",
    spirit_family: family,
    browse_style: style,
    popular_rank: item.rank,
    recognition_priority: 100
  };
}

function recordKeys(record) {
  return new Set(unique([record.name, ...(record.aliases || [])]).map(labelKey).filter(Boolean));
}

function intersects(left, right) {
  for (const value of left) if (right.has(value)) return true;
  return false;
}

function recordQuality(record) {
  return (record.image ? 100 : 0) + (record.desc ? 8 : 0) + (record.distillery ? 5 : 0) +
    (Number(record.proof) ? 3 : 0) + (Number(record.price) ? 2 : 0);
}

function mergeRecord(curated, matches) {
  const ordered = [...matches].sort((a, b) => recordQuality(b) - recordQuality(a));
  const best = ordered[0] || {};
  const result = { ...curated, id: best.id || curated.id };
  for (const field of [
    "distillery", "region", "proof", "abv", "mashbill", "price", "price_str", "price_pln",
    "quality", "value", "notes", "desc", "profile", "image", "status"
  ]) {
    if (best[field] !== undefined && best[field] !== null && best[field] !== "") result[field] = best[field];
  }
  result.aliases = unique([
    ...curated.aliases,
    ...ordered.flatMap((record) => [record.name, ...(record.aliases || [])])
  ]).filter((value) => ascii(value) !== ascii(curated.name));
  result.source_refs = unique([
    ...(curated.source_refs || []),
    ...ordered.flatMap((record) => [record.source, ...(record.source_refs || [])])
  ]);
  return result;
}

function compactScanRecord(record) {
  return {
    id: record.id,
    name: record.name,
    aliases: record.aliases || [],
    distillery: record.distillery || "",
    region: record.region || "",
    type: record.type || "",
    category: record.category || "",
    proof: record.proof ?? null,
    abv: record.abv ?? null,
    mashbill: record.mashbill ?? null,
    price: record.price ?? null,
    price_str: record.price_str || null,
    price_pln: record.price_pln || null,
    quality: record.quality ?? null,
    value: record.value ?? null,
    notes: record.notes || "",
    desc: record.profile?.pl?.general || record.desc || "",
    image: record.image || "",
    source: record.source || "popular_200_curated",
    catalog_status: record.catalog_status || "curated",
    popular_rank: record.popular_rank || null,
    recognition_priority: record.recognition_priority || 0
  };
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const scan = JSON.parse(fs.readFileSync(scanPath, "utf8"));
  const sourceRecords = (Array.isArray(catalog.bottles) ? catalog.bottles : []).filter(taxonomy.isVisibleBottle);
  const sourceScan = (Array.isArray(scan.bottles) ? scan.bottles : []).filter(taxonomy.isVisibleBottle);
  const sourceById = new Map(sourceRecords.map((record) => [record.id, record]));
  const scanById = new Map(sourceScan.map((record) => [record.id, record]));
  const combinedExisting = sourceScan.map((record) => ({ ...sourceById.get(record.id), ...record }));
  const manifestRows = [
    ...manifest.bourbon.map((item) => ({ item, family: "bourbon" })),
    ...manifest.whisky.map((item) => ({ item, family: "whisky" }))
  ];
  const curated = manifestRows.map(({ item, family }) => curatedRecord(item, family)).filter(taxonomy.isVisibleBottle);
  const curatedKeys = curated.map(recordKeys);
  const candidateMatches = curated.map(() => []);

  for (const existing of combinedExisting) {
    // Existing aliases often contain a bare brand shared by several expressions.
    // Only the primary label may claim an existing canonical record automatically.
    const keys = new Set([labelKey(existing.name)].filter(Boolean));
    const hits = curatedKeys.map((wanted, index) => intersects(keys, wanted) ? index : -1).filter((index) => index >= 0);
    if (hits.length === 1) candidateMatches[hits[0]].push(existing);
  }

  const claimedIds = new Set();
  const redirects = { ...(catalog.id_redirects || {}), ...(scan.id_redirects || {}) };
  const popularRecords = curated.map((record, index) => {
    const matches = candidateMatches[index].filter((item) => !claimedIds.has(item.id));
    const merged = mergeRecord(record, matches);
    for (const match of matches) {
      claimedIds.add(match.id);
      if (match.id !== merged.id) redirects[match.id] = merged.id;
    }
    return merged;
  });

  const popularCanonicalOwners = new Map(popularRecords.flatMap((record) =>
    [record.name, record.aliases?.[0]].filter(Boolean).map((name) => [labelKey(name), record.id])
  ));
  const retained = sourceRecords.filter((record) => !claimedIds.has(record.id)).map((record) => ({
    ...record,
    aliases: (record.aliases || []).filter((alias) => {
      const owner = popularCanonicalOwners.get(labelKey(alias));
      return !owner || owner === record.id;
    })
  }));
  const cleanedPopularRecords = popularRecords.map((record) => ({
    ...record,
    aliases: (record.aliases || []).filter((alias) => {
      const owner = popularCanonicalOwners.get(labelKey(alias));
      return !owner || owner === record.id;
    })
  }));
  let finalRecords = [...cleanedPopularRecords, ...retained];
  const safeDedupe = dedupeCatalogRecords(finalRecords);
  if (safeDedupe.removed) {
    const byId = new Map(finalRecords.map((record) => [record.id, record]));
    const removeIds = new Set();
    const replacements = [];
    for (const group of safeDedupe.groups || []) {
      const ids = [group.canonical_id, ...(group.merged_ids || [])];
      const members = ids.map((id) => byId.get(id)).filter(Boolean);
      const popular = members.find((record) => record.recognition_priority === 100);
      if (!popular || members.length < 2) continue;
      const merged = mergeRecord(popular, members);
      const replacement = {
        ...merged,
        id: popular.id,
        name: popular.name,
        source: "popular_200_curated",
        catalog_status: "curated",
        spirit_family: popular.spirit_family,
        browse_style: popular.browse_style,
        popular_rank: popular.popular_rank,
        recognition_priority: 100
      };
      members.forEach((record) => {
        removeIds.add(record.id);
        if (record.id !== replacement.id) redirects[record.id] = replacement.id;
      });
      replacements.push(replacement);
    }
    finalRecords = [...finalRecords.filter((record) => !removeIds.has(record.id)), ...replacements];
  }
  const finalPopularRecords = finalRecords
    .filter((record) => record.recognition_priority === 100)
    .sort((a, b) => (a.spirit_family === b.spirit_family ? a.popular_rank - b.popular_rank : a.spirit_family.localeCompare(b.spirit_family)));
  const matchedExistingCount = finalPopularRecords.filter((record) =>
    (record.source_refs || []).some((source) => source && source !== "popular-200-2026-v1")
  ).length;
  const finalIds = new Set(finalRecords.map((record) => record.id));
  for (const sourceId of Object.keys(redirects)) {
    let targetId = redirects[sourceId];
    const visited = new Set([sourceId]);
    while (redirects[targetId] && !visited.has(targetId)) {
      visited.add(targetId);
      targetId = redirects[targetId];
    }
    if (sourceId === targetId || finalIds.has(sourceId) || !finalIds.has(targetId)) delete redirects[sourceId];
    else redirects[sourceId] = targetId;
  }
  const finalScanRecords = finalRecords.map(compactScanRecord);
  const updated = new Date().toISOString();
  const meta = {
    ...catalog,
    version: 4,
    updated,
    count: finalRecords.length,
    popular_catalog_version: manifest.version,
    popular_catalog_count: finalPopularRecords.length,
    id_redirects: redirects
  };
  delete meta.bottles;
  delete meta.token_index;

  fs.writeFileSync(generatedPath, `${JSON.stringify({
    version: manifest.version,
    updated,
    count: finalPopularRecords.length,
    sources: manifest.sources,
    bottles: finalPopularRecords
  }, null, 2)}\n`);
  fs.writeFileSync(catalogPath, `${JSON.stringify({ ...meta, bottles: finalRecords }, null, 2)}\n`);
  fs.writeFileSync(scanPath, `${JSON.stringify({
    ...meta,
    bottles: finalScanRecords,
    token_index: buildCatalogTokenIndex(finalScanRecords)
  })}\n`);

  if (fs.existsSync(qualityReportPath)) {
    const quality = JSON.parse(fs.readFileSync(qualityReportPath, "utf8"));
    quality.updated = updated;
    quality.count = finalRecords.length;
    quality.source_rows = { ...(quality.source_rows || {}), popular: finalPopularRecords.length };
    quality.selected_verified_price = finalRecords.filter((record) => record.catalog_status === "verified").length;
    quality.selected_recognition_only = finalRecords.filter((record) => record.catalog_status !== "verified").length;
    quality.missing = {
      proof: finalRecords.filter((record) => !record.proof).length,
      abv: finalRecords.filter((record) => !record.abv).length,
      distillery: finalRecords.filter((record) => !record.distillery).length,
      price: finalRecords.filter((record) => !record.price).length
    };
    fs.writeFileSync(qualityReportPath, `${JSON.stringify(quality, null, 2)}\n`);
  }
  if (fs.existsSync(retailReportPath)) {
    const retail = JSON.parse(fs.readFileSync(retailReportPath, "utf8"));
    retail.updated = updated;
    retail.after = finalRecords.length;
    retail.popular_catalog_count = finalPopularRecords.length;
    fs.writeFileSync(retailReportPath, `${JSON.stringify(retail, null, 2)}\n`);
  }

  const report = {
    version: manifest.version,
    updated,
    requested: { bourbon: manifest.bourbon.length, whisky: manifest.whisky.length, total: manifestRows.length },
    canonical_records: finalPopularRecords.length,
    matched_existing: matchedExistingCount,
    added_new: finalPopularRecords.length - matchedExistingCount,
    inherited_images: finalPopularRecords.filter((record) => record.image).length,
    aliases: finalPopularRecords.reduce((sum, record) => sum + record.aliases.length, 0),
    catalog_before: sourceRecords.length,
    catalog_after: finalRecords.length,
    records: finalPopularRecords.map((record) => ({
      rank: record.popular_rank,
      family: record.spirit_family,
      id: record.id,
      name: record.name,
      aliases: record.aliases.length,
      image: !!record.image,
      status: (record.source_refs || []).some((source) => source && source !== "popular-200-2026-v1") ? "matched" : "added"
    }))
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    version: report.version,
    requested: report.requested,
    matched_existing: report.matched_existing,
    added_new: report.added_new,
    inherited_images: report.inherited_images,
    aliases: report.aliases,
    catalog_before: report.catalog_before,
    catalog_after: report.catalog_after
  }, null, 2)}\n`);
}

main();
