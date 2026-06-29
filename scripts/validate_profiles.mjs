import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const db = JSON.parse(fs.readFileSync(path.join(root, "db", "bourbons.json"), "utf8"));
const profilesFile = JSON.parse(fs.readFileSync(path.join(root, "db", "profiles-runtime.json"), "utf8"));

const idsBlock = index.slice(
  index.indexOf("const RUNTIME_BOTTLE_IDS"),
  index.indexOf("];", index.indexOf("const RUNTIME_BOTTLE_IDS"))
);
const runtimeIds = [...idsBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const byId = new Map((db.bottles || []).map((b) => [b.id, b]));

const required = ["general", "nose", "taste", "finish"];
const errors = [];
const seen = new Map();

function hasPolish(s) {
  return /[\u0105\u0107\u0119\u0142\u0144\u00f3\u015b\u017a\u017c]/i.test(s);
}

function hasMojibake(s) {
  return /[ÄÅĂĹ]/.test(s);
}

for (const id of runtimeIds) {
  const bottle = byId.get(id);
  if (!bottle) {
    errors.push(`${id}: missing bottle`);
    continue;
  }
  const entry = profilesFile.profiles && profilesFile.profiles[id];
  if (!entry) {
    errors.push(`${id}: missing profile entry`);
    continue;
  }
  for (const lang of ["en", "pl"]) {
    const profile = entry.profile && entry.profile[lang];
    if (!profile) {
      errors.push(`${id}: missing profile.${lang}`);
      continue;
    }
    for (const field of required) {
      const value = String(profile[field] || "").trim();
      if (!value) errors.push(`${id}: missing profile.${lang}.${field}`);
      if (value.length < 24) errors.push(`${id}: too short profile.${lang}.${field}`);
      if (lang === "en" && hasPolish(value)) errors.push(`${id}: Polish chars in EN ${field}`);
      if (hasMojibake(value)) errors.push(`${id}: mojibake in ${lang}.${field}`);
      if (["nose", "taste", "finish"].includes(field)) {
        const name = String(bottle.name || "").trim().toLowerCase();
        if (name && value.toLowerCase().startsWith(name)) errors.push(`${id}: ${lang}.${field} starts with bottle name`);
      }
      const key = `${lang}:${field}:${value}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    }
  }
}

for (const [key, count] of seen.entries()) {
  if (count > 3) errors.push(`Repeated text ${count}x: ${key.slice(0, 120)}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Profile validation OK for ${runtimeIds.length} runtime bottles.`);
