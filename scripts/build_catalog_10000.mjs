import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { buildCatalogTokenIndex, dedupeCatalogRecords } from "./catalog_identity.mjs";
import { MAX_RETAIL_USD, RETAIL_FILTER_VERSION, retailPriceUsd, retailRemovalReason } from "./catalog_retail_policy.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "db", "catalog");
const EXISTING_DB = path.join(ROOT, "db", "bourbons.json");
const MANUAL_DB = path.join(ROOT, "db", "catalog", "manual-popular-whisky.json");
const POPULAR_DB = path.join(ROOT, "db", "catalog", "popular-200-catalog.json");
const OLCC_FILE = process.env.OLCC_FILE || path.join(process.env.TEMP || "", "olcc-pricing.csv");
const TARGET = Number(process.env.CATALOG_TARGET || 10000);
const TTB_FROM = process.env.TTB_FROM || "2024-01-01";
const TTB_TO = process.env.TTB_TO || new Date().toISOString().slice(0, 10);
const PRICE_LIMIT_USD = 350;
const PRICE_LIMIT_PLN = 1000;
const TTB_BASE = "https://www.ttbonline.gov/colasonline/";
const UA = "BourbonHuntersCatalog/1.0 (public-data research)";
const TTB_CACHE = process.env.TTB_CACHE || path.join(os.tmpdir(), "bourbon-hunters-ttb-cache.json");

const COOKIE_JAR = path.join(os.tmpdir(), "bourbon-hunters-ttb-cookies.txt");

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanTtb(value) {
  let result = clean(value);
  if (/[ÃÂ]/.test(result)) {
    const cp1252 = new Map([
      ["€", 0x80], ["‚", 0x82], ["ƒ", 0x83], ["„", 0x84], ["…", 0x85], ["†", 0x86], ["‡", 0x87],
      ["ˆ", 0x88], ["‰", 0x89], ["Š", 0x8a], ["‹", 0x8b], ["Œ", 0x8c], ["Ž", 0x8e],
      ["‘", 0x91], ["’", 0x92], ["“", 0x93], ["”", 0x94], ["•", 0x95], ["–", 0x96], ["—", 0x97],
      ["˜", 0x98], ["™", 0x99], ["š", 0x9a], ["›", 0x9b], ["œ", 0x9c], ["ž", 0x9e], ["Ÿ", 0x9f]
    ]);
    const bytes = Uint8Array.from([...result].map((character) => cp1252.get(character) ?? (character.codePointAt(0) & 0xff)));
    result = new TextDecoder("utf-8").decode(bytes);
  }
  return result.replace(/([\p{L}])¿(?=[\p{L}])/gu, "$1'");
}

function ascii(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value) {
  return ascii(value).replace(/ /g, "-").replace(/^-+|-+$/g, "");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows.shift().map(clean);
  return rows
    .filter((values) => values.some((value) => clean(value)))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, clean(values[index])])));
}

function formatDate(date) {
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function request(url, options = {}) {
  const args = [
    "-L", "--fail", "--silent", "--show-error", "--max-time", "90",
    "-A", UA, "-c", COOKIE_JAR, "-b", COOKIE_JAR
  ];
  if (options.method === "POST") {
    args.push("-X", "POST", "-H", "Content-Type: application/x-www-form-urlencoded", "--data", String(options.body || ""));
  }
  args.push(url);
  return execFileSync("curl.exe", args, { encoding: null, maxBuffer: 64 * 1024 * 1024 });
}

function establishSession() {
  if (fs.existsSync(COOKIE_JAR)) fs.unlinkSync(COOKIE_JAR);
  request(`${TTB_BASE}publicSearchColasBasic.do`);
}

async function searchTtb(from, to) {
  const body = new URLSearchParams({
    "searchCriteria.dateCompletedFrom": formatDate(from),
    "searchCriteria.dateCompletedTo": formatDate(to),
    "searchCriteria.productOrFancifulName": "",
    "searchCriteria.productNameSearchType": "E",
    "searchCriteria.classTypeFrom": "100",
    "searchCriteria.classTypeTo": "199",
    "searchCriteria.originCode": ""
  });
  const result = request(`${TTB_BASE}publicSearchColasBasicProcess.do?action=search`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const html = new TextDecoder("windows-1252").decode(result);
  const total = Number((html.match(/Total Matching Records:\s*([0-9,]+)/i)?.[1] || "0").replace(/,/g, ""));
  if (total > 1000) {
    const span = Math.floor((to - from) / 86400000);
    if (span < 1) throw new Error(`TTB daily result exceeds export limit: ${formatDate(from)} (${total})`);
    const middle = addDays(from, Math.floor(span / 2));
    return [...await searchTtb(from, middle), ...await searchTtb(addDays(middle, 1), to)];
  }
  if (!total) return [];
  const exportResponse = request(`${TTB_BASE}publicSaveSearchResultsToFile.do?path=/publicSearchColasBasicProcess`);
  const csv = new TextDecoder("windows-1252").decode(exportResponse);
  const rows = parseCsv(csv);
  process.stdout.write(`TTB ${formatDate(from)}..${formatDate(to)}: ${rows.length}\n`);
  return rows;
}

async function downloadTtb() {
  if (fs.existsSync(TTB_CACHE)) {
    const cached = JSON.parse(fs.readFileSync(TTB_CACHE, "utf8"));
    if (cached.from === TTB_FROM && cached.to === TTB_TO && Array.isArray(cached.rows)) {
      process.stdout.write(`TTB cache: ${cached.rows.length}\n`);
      return cached.rows;
    }
  }
  establishSession();
  const start = new Date(`${TTB_FROM}T00:00:00Z`);
  const end = new Date(`${TTB_TO}T00:00:00Z`);
  const rows = [];
  for (let cursor = start; cursor <= end;) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const chunkEnd = monthEnd < end ? monthEnd : end;
    rows.push(...await searchTtb(cursor, chunkEnd));
    cursor = addDays(chunkEnd, 1);
  }
  fs.writeFileSync(TTB_CACHE, JSON.stringify({ from: TTB_FROM, to: TTB_TO, rows }));
  return rows;
}

function readOlcc() {
  if (!OLCC_FILE || !fs.existsSync(OLCC_FILE)) return [];
  const rows = parseCsv(fs.readFileSync(OLCC_FILE, "utf8"));
  const latest = rows.reduce((max, row) => row.AsOfDate > max ? row.AsOfDate : max, "");
  return rows.filter((row) => row.AsOfDate === latest && /WHISK|BOURBON|SCOTCH|RYE/i.test(row.Category || ""));
}

function priceBand(usd) {
  if (!Number.isFinite(usd) || usd <= 0) return null;
  if (usd <= 25) return "$15-30";
  if (usd <= 50) return "$25-55";
  if (usd <= 80) return "$50-90";
  if (usd <= 120) return "$80-130";
  if (usd <= 180) return "$120-200";
  if (usd <= 250) return "$180-275";
  return "$250-350";
}

function matchKey(value) {
  return ascii(value)
    .replace(/\b(50|100|200|375|500|700|750|1000|1750)\s*(ml|l)?\b/g, " ")
    .replace(/\b(whisky|whiskey|bourbon|straight|kentucky|scotch|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function olccIndex(rows) {
  const map = new Map();
  for (const row of rows) {
    const price = Number(row.PricePerBottle);
    if (!Number.isFinite(price) || price <= 0 || price > PRICE_LIMIT_USD) continue;
    const key = matchKey(row.Description);
    if (!key) continue;
    const size = Number(String(row.Size || "").match(/[0-9.]+/)?.[0] || 0);
    const sizeRank = size === 750 ? 0 : size === 700 ? 1 : size === 1000 ? 2 : size >= 500 && size <= 1000 ? 3 : 9;
    const current = map.get(key);
    if (!current || sizeRank < current.sizeRank || (sizeRank === current.sizeRank && price < current.price)) {
      map.set(key, { price, row, sizeRank });
    }
  }
  return { map, entries: [...map.entries()] };
}

function findPrice(name, prices) {
  const key = matchKey(name);
  if (!key) return null;
  const exact = prices.map.get(key);
  if (exact) return exact;
  const wanted = new Set(key.split(" ").filter((token) => token.length > 1));
  if (!wanted.size) return null;
  let best = null;
  for (const [candidateKey, value] of prices.entries) {
    const candidate = new Set(candidateKey.split(" ").filter((token) => token.length > 1));
    const common = [...wanted].filter((token) => candidate.has(token)).length;
    const union = new Set([...wanted, ...candidate]).size;
    const score = union ? common / union : 0;
    if (common >= 2 && score >= 0.72 && (!best || score > best.score)) best = { ...value, score };
  }
  return best;
}

function classify(type) {
  const text = ascii(type);
  if (text.includes("single malt scotch")) return { category: "Single Malt Scotch", mashbill: "Słodowany jęczmień zgodnie z deklaracją Single Malt Scotch" };
  if (text.includes("scotch")) return { category: "Scotch", mashbill: "Słodowany jęczmień lub blend zgodny z deklaracją Scotch" };
  if (text.includes("rye")) return { category: "Rye", mashbill: "Profil żytni; dokładny mashbill wymaga danych producenta" };
  if (text.includes("wheat")) return { category: "Wheat Whiskey", mashbill: "Profil pszeniczny; dokładny mashbill wymaga danych producenta" };
  if (text.includes("corn")) return { category: "Corn Whiskey", mashbill: "Co najmniej 80% kukurydzy dla amerykańskiego corn whiskey" };
  if (text.includes("bourbon")) return {
    category: text.includes("bond") || /\bbib\b/.test(text) ? "Bottled in Bond" : text.includes("straight") ? "Straight Bourbon" : "Bourbon",
    mashbill: "Co najmniej 51% kukurydzy; dokładny mashbill wymaga danych producenta"
  };
  if (text.includes("irish")) return { category: "Irish Whiskey", mashbill: "Zbożowy profil Irish Whiskey; skład zależy od edycji" };
  if (text.includes("canadian")) return { category: "Canadian Whisky", mashbill: "Zbożowy blend; dokładny skład zależy od producenta" };
  return { category: "Whiskey", mashbill: "Dokładny mashbill wymaga danych producenta" };
}

function profileFor(record) {
  const style = ascii(`${record.type} ${record.category}`);
  let enNotes = ["grain sweetness", "vanilla", "gentle oak", "warm spice"];
  let plNotes = ["zbożowa słodycz", "wanilia", "łagodny dąb", "ciepłe przyprawy"];
  if (style.includes("scotch")) {
    enNotes = ["malted grain", "orchard fruit", "oak", "soft spice"];
    plNotes = ["słodowane zboże", "owoce sadu", "dąb", "łagodne przyprawy"];
  } else if (style.includes("rye")) {
    enNotes = ["rye spice", "herbs", "caramel", "dry oak"];
    plNotes = ["żytnie przyprawy", "zioła", "karmel", "suchy dąb"];
  } else if (style.includes("bourbon")) {
    enNotes = ["caramel", "vanilla", "corn sweetness", "charred oak"];
    plNotes = ["karmel", "wanilia", "kukurydziana słodycz", "opalany dąb"];
  } else if (style.includes("irish")) {
    enNotes = ["honeyed grain", "apple", "vanilla", "soft spice"];
    plNotes = ["miodowe zboże", "jabłko", "wanilia", "łagodne przyprawy"];
  }
  return {
    basis: "style_estimate",
    confidence: "low",
    en: {
      general: `${record.name} is registered in the TTB label database as ${record.type.toLowerCase()}${record.region ? ` from ${record.region}` : ""}.`,
      nose: `Expected style profile: ${enNotes[0]}, ${enNotes[1]} and ${enNotes[2]}.`,
      taste: `Expected style profile: ${enNotes[1]}, ${enNotes[2]} and ${enNotes[3]}.`,
      finish: `Expected style profile: a balanced close of ${enNotes[2]} and ${enNotes[3]}.`
    },
    pl: {
      general: `${record.name} figuruje w rejestrze etykiet TTB jako ${record.type.toLowerCase()}${record.region ? ` z regionu ${record.region}` : ""}.`,
      nose: `Przewidywany profil stylu: ${plNotes[0]}, ${plNotes[1]} i ${plNotes[2]}.`,
      taste: `Przewidywany profil stylu: ${plNotes[1]}, ${plNotes[2]} i ${plNotes[3]}.`,
      finish: `Przewidywany profil stylu: zbalansowane domknięcie z nutą ${plNotes[2]} i ${plNotes[3]}.`
    }
  };
}

function premiumRisk(name) {
  const value = ascii(name);
  const age = Number(value.match(/\b(\d{2})\s*(year|yr|yo)\b/)?.[1] || 0);
  return age >= 18 || /\b(ultra rare|very rare|exceptional|diamond jubilee|decanter|crystal|collector|collectors|private collection)\b/.test(value);
}

function fromTtb(row, prices, distilleries) {
  const brand = cleanTtb(row["Brand Name"]);
  const fanciful = cleanTtb(row["Fanciful Name"]);
  if (!brand) return null;
  const name = fanciful && !ascii(brand).includes(ascii(fanciful)) ? `${brand} ${fanciful}` : brand;
  if (premiumRisk(name)) return null;
  const type = cleanTtb(row["Class/Type Desc"]) || "Whisky";
  const style = classify(type);
  const priceHit = findPrice(name, prices);
  const price = priceHit?.price ?? null;
  const ttbId = clean(row["TTB ID"]).replace(/^'+|'+$/g, "");
  const record = {
    id: slug(`${name}-${row["Class/Type"]}-${row.Origin}`),
    name,
    aliases: [...new Set([brand, fanciful, `${fanciful} ${brand}`].map(clean).filter(Boolean))],
    distillery: distilleries.get(ascii(brand)) || null,
    producer_permit: cleanTtb(row["Permit No."]) || null,
    region: cleanTtb(row["Origin Desc"]) || null,
    type,
    category: style.category,
    proof: priceHit ? Number(priceHit.row.Proof) || null : null,
    abv: priceHit ? (Number(priceHit.row.Proof) || 0) / 2 || null : null,
    mashbill: style.mashbill,
    price: price,
    price_currency: price ? "USD" : null,
    price_range: priceBand(price),
    price_status: price ? "verified" : "unknown",
    quality: null,
    value: null,
    notes: null,
    desc: `${name} — ${type}${row["Origin Desc"] ? `, ${cleanTtb(row["Origin Desc"])}` : ""}. Dane identyfikacyjne pochodzą z publicznego rejestru etykiet TTB.`,
    image: "",
    status: "catalog",
    source: "ttb-cola",
    source_id: ttbId,
    source_url: ttbId ? `${TTB_BASE}publicSearchColasBasic.do?action=publicDisplaySearchBasic&ttbid=${encodeURIComponent(ttbId)}` : null,
    completed_date: cleanTtb(row["Completed Date"]) || null,
    catalog_status: price ? "verified" : "recognition_only"
  };
  record.profile = profileFor(record);
  record.notes = record.profile.pl.nose.replace(/^Przewidywany profil stylu:\s*/i, "");
  return record;
}

function fromExisting(bottle) {
  const price = Number(bottle.price);
  const isUsd = String(bottle.price_str || "").includes("$") || /woodencork/.test(bottle.source || "");
  if (Number.isFinite(price) && ((isUsd && price > PRICE_LIMIT_USD) || (!isUsd && price > PRICE_LIMIT_PLN))) return null;
  const record = {
    ...bottle,
    aliases: Array.isArray(bottle.aliases) ? bottle.aliases : [],
    price_status: Number.isFinite(price) ? "verified" : "unknown",
    catalog_status: Number.isFinite(price) ? "verified" : "recognition_only"
  };
  record.profile = profileFor(record);
  return record;
}

function fromOlcc(row) {
  const price = Number(row.PricePerBottle);
  const proof = Number(row.Proof);
  const size = Number(String(row.Size || "").match(/[0-9.]+/)?.[0] || 0);
  if (!Number.isFinite(price) || price <= 0 || price > PRICE_LIMIT_USD) return null;
  if (size < 500 || size > 1000 || /PACK|SET|MINI|CAN/i.test(`${row.Description} ${row.ContainerType}`)) return null;
  const name = clean(row.Description);
  if (!name || premiumRisk(name)) return null;
  const type = clean(row.Category) || "Whisky";
  const style = classify(type);
  const record = {
    id: `olcc-${slug(row.ItemCode || name)}`,
    name,
    aliases: [name],
    distillery: null,
    producer_permit: null,
    region: clean(row.CountryOfOrigin) || null,
    type,
    category: style.category,
    proof: Number.isFinite(proof) && proof > 0 ? proof : null,
    abv: Number.isFinite(proof) && proof > 0 ? proof / 2 : null,
    mashbill: style.mashbill,
    price,
    price_currency: "USD",
    price_range: priceBand(price),
    price_status: "verified",
    quality: null,
    value: null,
    notes: null,
    desc: `${name} — ${type}, ${proof ? `${proof} proof, ` : ""}${clean(row.CountryOfOrigin) || "kraj niepodany"}. Cena referencyjna pochodzi z oficjalnego katalogu OLCC.`,
    image: "",
    status: "catalog",
    source: "olcc",
    source_id: clean(row.ItemCode) || null,
    source_url: "https://data.oregon.gov/d/vmf2-f83h",
    catalog_status: "verified"
  };
  record.profile = profileFor(record);
  record.notes = record.profile.pl.nose.replace(/^Przewidywany profil stylu:\s*/i, "");
  return record;
}

function dedupe(records) {
  return dedupeCatalogRecords(records.filter((record)=>record?.name&&matchKey(record.name)));
}

function buildDistilleryIndex(existing, ttbRows) {
  const map = new Map();
  const brands = [...new Set(ttbRows.map((row) => cleanTtb(row["Brand Name"])).filter(Boolean))];
  for (const brand of brands) {
    const key = matchKey(brand);
    if (!key) continue;
    const counts = new Map();
    for (const bottle of existing) {
      const bottleKey = matchKey(bottle.name);
      if (!bottle.distillery || !(bottleKey === key || bottleKey.startsWith(`${key} `))) continue;
      counts.set(bottle.distillery, (counts.get(bottle.distillery) || 0) + 1);
    }
    const winner = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (winner) map.set(ascii(brand), winner);
  }
  return map;
}

function scanRecord(record) {
  const generic = new Set(["bourbon", "whisky", "whiskey", "straight", "bottled", "bond", "single", "barrel", "cask", "proof", "rye", "scotch", "malt", "blend", "blended", "reserve", "batch", "finish", "finished", "the", "and", "for", "with"]);
  const aliases = (record.aliases || []).filter((alias) => {
    const tokens = matchKey(alias).split(" ").filter((token) => token.length > 2);
    return tokens.length >= 2 && tokens.some((token) => !generic.has(token));
  });
  return {
    id: record.id,
    name: record.name,
    aliases,
    distillery: record.distillery,
    region: record.region,
    type: record.type,
    category: record.category,
    proof: record.proof,
    abv: record.abv,
    mashbill: record.mashbill,
    price: record.price,
    price_str: record.price_range || (record.price ? `$${record.price}` : null),
    price_pln: record.price_pln || null,
    quality: record.quality,
    value: record.value,
    notes: record.notes,
    desc: record.profile?.pl?.general || record.desc,
    image: record.image || "",
    source: record.source,
    catalog_status: record.catalog_status
  };
}

async function main() {
  const existingRaw = JSON.parse(fs.readFileSync(EXISTING_DB, "utf8")).bottles;
  const existing = existingRaw.map(fromExisting).filter(Boolean);
  const manualRaw = fs.existsSync(MANUAL_DB) ? JSON.parse(fs.readFileSync(MANUAL_DB, "utf8")).bottles || [] : [];
  const manual = manualRaw.map(fromExisting).filter(Boolean);
  const popularRaw = fs.existsSync(POPULAR_DB) ? JSON.parse(fs.readFileSync(POPULAR_DB, "utf8")).bottles || [] : [];
  const popular = popularRaw.map(fromExisting).filter(Boolean);
  const olcc = readOlcc();
  const olccRecords = olcc.map(fromOlcc).filter(Boolean);
  const prices = olccIndex(olcc);
  const ttbRows = await downloadTtb();
  const distilleries = buildDistilleryIndex(existingRaw, ttbRows);
  const ttb = ttbRows.map((row) => fromTtb(row, prices, distilleries)).filter(Boolean);
  const dedupeResult = dedupe([...popular, ...existing, ...manual, ...olccRecords, ...ttb]);
  const merged = dedupeResult.records;
  const retailRemoved=merged.map((record)=>({record,reason:retailRemovalReason(record)})).filter((item)=>item.reason);
  const retailEligible=merged.filter((record)=>!retailRemovalReason(record));
  if (retailEligible.length < 9000) throw new Error(`Only ${retailEligible.length} retail-relevant records passed validation; need at least 9000.`);
  const verified = retailEligible.filter((record) => record.catalog_status === "verified");
  const recognition = retailEligible.filter((record) => record.catalog_status !== "verified");
  const selected = [...verified, ...recognition].slice(0, TARGET);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const selectedIds=new Set(selected.map((record)=>record.id));
  const redirects=Object.fromEntries(Object.entries(dedupeResult.redirects).filter(([,canonicalId])=>selectedIds.has(canonicalId)));
  const meta = {
    version: 3,
    updated: new Date().toISOString(),
    count: selected.length,
    target: TARGET,
    price_limits: { PLN: PRICE_LIMIT_PLN, USD: PRICE_LIMIT_USD },
    profile_policy: "Tasting text marked style_estimate is an original expected style profile, not a verified producer tasting note.",
    sources: ["Popular 200 curated catalog", "Existing Bourbon Hunters catalog", "TTB Public COLA Registry", "Oregon OLCC Monthly Pricing"],
    dedupe_version:"catalog-identity-safe-v1",
    duplicate_records_removed:dedupeResult.removed,
    retail_filter_version:RETAIL_FILTER_VERSION,
    retail_max_usd:MAX_RETAIL_USD,
    retail_records_removed:retailRemoved.length,
    id_redirects:redirects
  };
  fs.writeFileSync(path.join(OUT_DIR, "bottles.json"), `${JSON.stringify({ ...meta, bottles: selected }, null, 2)}\n`);
  const scanBottles = selected.map(scanRecord);
  fs.writeFileSync(path.join(OUT_DIR, "scan-index.json"), `${JSON.stringify({ ...meta, bottles: scanBottles, token_index: buildCatalogTokenIndex(scanBottles) })}\n`);
  fs.writeFileSync(path.join(OUT_DIR, "dedupe-redirects.json"), `${JSON.stringify({version:1,updated:meta.updated,count:Object.keys(redirects).length,redirects,groups:dedupeResult.groups},null,2)}\n`);
  const retailReasons=retailRemoved.reduce((counts,item)=>{
    counts[item.reason]=(counts[item.reason]||0)+1;
    return counts;
  },{});
  fs.writeFileSync(path.join(OUT_DIR, "retail-filter-report.json"), `${JSON.stringify({
    version:1,updated:meta.updated,policy:RETAIL_FILTER_VERSION,max_usd:MAX_RETAIL_USD,
    before:merged.length,after:selected.length,removed:retailRemoved.length,reasons:retailReasons,
    records:retailRemoved.map((item)=>({
      id:item.record.id,name:item.record.name,reason:item.reason,source:item.record.source,
      completed_date:item.record.completed_date||null,price_usd:retailPriceUsd(item.record)||null
    }))
  },null,2)}\n`);
  const report = {
    ...meta,
    source_rows: { popular: popular.length, existing: existing.length, ttb: ttbRows.length, olcc_current_whisky: olcc.length, olcc_eligible: olccRecords.length },
    deduplicated: merged.length,
    retail_eligible: retailEligible.length,
    retail_removal_reasons: retailReasons,
    selected_verified_price: selected.filter((record) => record.catalog_status === "verified").length,
    selected_recognition_only: selected.filter((record) => record.catalog_status !== "verified").length,
    missing: {
      proof: selected.filter((record) => !record.proof).length,
      abv: selected.filter((record) => !record.abv).length,
      distillery: selected.filter((record) => !record.distillery).length,
      price: selected.filter((record) => !record.price).length
    }
  };
  fs.writeFileSync(path.join(OUT_DIR, "quality-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
