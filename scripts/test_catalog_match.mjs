import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const root = path.resolve(import.meta.dirname, "..");
const db = JSON.parse(fs.readFileSync(path.join(root, "db", "catalog", "scan-index.json"), "utf8"));

function norm(value) {
  return String(value || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function toks(value) {
  return norm(value).split(" ").filter((word) => word.length >= 3 || /^[0-9]+$/.test(word));
}

const genericTokens = new Set([
  "whiskey","whisky","bourbon","american","single","malt","straight","domestic","kentucky",
  "blended","blend","spirit","spirits","distillery","distilling","reserve","small","batch",
  "barrel","cask","aged","year","years","proof","bottled","bond","rye","grain","oak",
  "finish","finished","label","edition","limited","release","original"
]);
function distinctiveTokens(value) {
  return [...new Set(toks(value).filter((word) => !genericTokens.has(word)))];
}

function score(text, bottle) {
  const inputTokens = toks(text);
  if (!inputTokens.length) return 0;
  let best = 0;
  for (const candidate of [bottle.name, ...(bottle.aliases || [])]) {
    const candidateTokens = toks(candidate);
    if (!candidateTokens.length) continue;
    const inputSet = new Set(inputTokens);
    const inputNorm = norm(text);
    const candidateNorm = norm(candidate);
    if (inputNorm === candidateNorm) best = Math.max(best, 1);
    else if (inputNorm.includes(candidateNorm)) {
      const coverage = candidateTokens.length / inputTokens.length;
      best = Math.max(best, coverage >= 0.5 ? Math.min(0.98, 0.9 + coverage * 0.08) : 0.55 + coverage * 0.35);
    }
    else if (candidateNorm.includes(inputNorm)) best = Math.max(best, Math.min(0.88, (inputTokens.length / candidateTokens.length) * 0.88));
    else {
      const matched = candidateTokens.filter((word) => inputSet.has(word)).length;
      if (matched) best = Math.max(best, Math.min(0.9, matched / candidateTokens.length));
    }
  }
  return best;
}

function rankedMatches(text) {
  const inputDistinctive = distinctiveTokens(text);
  if (!inputDistinctive.length) return [];
  const candidateIndexes = new Set();
  for (const token of inputDistinctive) for (const index of db.token_index?.[token] || []) candidateIndexes.add(index);
  return [...candidateIndexes].map((index) => db.bottles[index]).filter((bottle) => {
    const anchors = distinctiveTokens([bottle.name, ...(bottle.aliases || [])].join(" "));
    return anchors.some((token) => inputDistinctive.includes(token));
  }).map((bottle) => ({ id: bottle.id, name: bottle.name, score: score(text, bottle) }))
    .sort((a, b) => b.score - a.score);
}

function assertMatch(text, expectedId) {
  const started = performance.now();
  const matches = rankedMatches(text);
  const elapsedMs = performance.now() - started;
  if (matches[0]?.id !== expectedId) {
    throw new Error(`Expected ${expectedId}, got ${matches[0]?.id || "none"}: ${JSON.stringify(matches.slice(0, 5))}`);
  }
  return { text, expectedId, candidateCount: matches.length, score: matches[0].score, elapsedMs: Number(elapsedMs.toFixed(2)), top3: matches.slice(0, 3) };
}

function assertNoMatch(text) {
  const matches = rankedMatches(text);
  if (matches.length) throw new Error(`Expected no match for ${text}, got ${JSON.stringify(matches.slice(0, 5))}`);
  return { text, expectedId: null, candidateCount: 0, score: 0 };
}

const results = [
  assertMatch("Bulleit Bourbon Bottled in Bond 100 proof", "bulleit-bottled-in-bond-111-22"),
  assertMatch("Glenmorangie Triple Cask Reserve single malt scotch", "olcc-13148b"),
  assertMatch("Bulleit American Single Malt Whiskey 90 proof", "olcc-11838b"),
  assertNoMatch("American Single Malt Whiskey")
];

console.log(JSON.stringify({ ok: true, count: db.bottles.length, results }, null, 2));
