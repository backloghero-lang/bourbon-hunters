import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const root = path.resolve(import.meta.dirname, "..");
const db = JSON.parse(fs.readFileSync(path.join(root, "db", "catalog", "scan-index.json"), "utf8"));
const jeffersonBase=db.bottles.find((bottle)=>bottle.id==="jeffersons-very-small-batch-bourbon-whiskey-copy");
if(jeffersonBase){
  jeffersonBase.aliases=[...(jeffersonBase.aliases||[]),"Jefferson's Bourbon","Jefferson's Blend of Straight Bourbon Whiskey"];
  jeffersonBase.abv=41.15;
}

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
  "finish","finished","label","edition","limited","release","original","old"
]);
function distinctiveTokens(value) {
  return [...new Set(toks(value).filter((word) => !genericTokens.has(word)))];
}

// Production rebuilds the token index after applying aliases and redirects.
db.token_index={};
db.bottles.forEach((bottle,index)=>{
  if(!bottle || bottle.scan_disabled) return;
  for(const token of distinctiveTokens([bottle.name,bottle.distillery,...(bottle.aliases||[])].join(" "))){
    if(!db.token_index[token]) db.token_index[token]=[];
    if(!db.token_index[token].includes(index)) db.token_index[token].push(index);
  }
});

function spiritClass(value) {
  const text=norm(value);
  if(text.includes("bourbon")) return "bourbon";
  if(/\brye\b/.test(text)) return "rye";
  return "";
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
    const observedSpirit=spiritClass(text);
    const bottleSpirit=spiritClass(`${bottle.category||""} ${bottle.type||""} ${bottle.name||""}`);
    if(observedSpirit && bottleSpirit && observedSpirit!==bottleSpirit) return false;
    const anchors = distinctiveTokens([bottle.name, ...(bottle.aliases || [])].join(" "));
    const lexicalAnchors = anchors.filter((token) => !/^\d+$/.test(token));
    return (lexicalAnchors.length ? lexicalAnchors : anchors).some((token) => inputDistinctive.includes(token));
  }).map((bottle) => {
    const bottleDistinctive=distinctiveTokens([bottle.name,...(bottle.aliases||[])].join(" "));
    const unmatchedObserved=inputDistinctive.filter((token)=>!bottleDistinctive.includes(token));
    const unmatchedBottle=bottleDistinctive.filter((token)=>!inputDistinctive.includes(token));
    let matchScore=score(text,bottle);
    if(unmatchedObserved.length && unmatchedBottle.length) matchScore=Math.min(matchScore,0.79);
    return {id:bottle.id,name:bottle.name,score:matchScore};
  })
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
function assertNoConfidentMatch(text) {
  const matches=rankedMatches(text);
  if((matches[0]?.score||0)>=0.8) throw new Error(`Expected no confident match for ${text}, got ${JSON.stringify(matches.slice(0,5))}`);
  return {text,expectedId:null,candidateCount:matches.length,score:matches[0]?.score||0};
}
function assertExcluded(text, excludedId) {
  const matches=rankedMatches(text);
  if(matches.some((match)=>match.id===excludedId)) throw new Error(`Expected ${excludedId} to be excluded for ${text}`);
  return {text,excludedId,excluded:true};
}

function selectConfirmationCandidates(matches, minConfidence = 0.8, multiCandidateConfidence = 0.9) {
  if(!matches[0] || matches[0].score<minConfidence) return [];
  const highConfidence=matches.filter((match)=>match.score>=multiCandidateConfidence).slice(0,2);
  return highConfidence.length>=2 ? highConfidence : [matches[0]];
}

function confirmationCandidates(text) {
  return selectConfirmationCandidates(rankedMatches(text));
}

function assertConfirmationSet(text, expectedIds) {
  const candidates=confirmationCandidates(text);
  const ids=candidates.map((candidate)=>candidate.id);
  if(JSON.stringify(ids)!==JSON.stringify(expectedIds)) {
    throw new Error(`Expected confirmation candidates ${JSON.stringify(expectedIds)}, got ${JSON.stringify(ids)}`);
  }
  return {text,confirmationCandidates:ids};
}

function assertSelectionPolicy(label, scores, expectedIds) {
  const candidates=selectConfirmationCandidates(scores.map((score,index)=>({id:`candidate-${index+1}`,score})));
  const ids=candidates.map((candidate)=>candidate.id);
  if(JSON.stringify(ids)!==JSON.stringify(expectedIds)) {
    throw new Error(`Expected ${label} to select ${JSON.stringify(expectedIds)}, got ${JSON.stringify(ids)}`);
  }
  return {text:label,confirmationCandidates:ids};
}

const results = [
  assertMatch("Bulleit Bourbon Bottled in Bond 100 proof", "bulleit-bottled-in-bond-111-22"),
  assertMatch("Glenmorangie Triple Cask Reserve single malt scotch", "olcc-13148b"),
  assertMatch("Bulleit American Single Malt Whiskey 90 proof", "olcc-11838b"),
  assertMatch("Jefferson's Bourbon Blend of Straight Bourbon Whiskey 82.3 proof", "jeffersons-very-small-batch-bourbon-whiskey-copy"),
  assertConfirmationSet("Jefferson's Bourbon Blend of Straight Bourbon Whiskey 82.3 proof", [
    "jeffersons-very-small-batch-bourbon-whiskey-copy"
  ]),
  assertConfirmationSet("Bulleit Bourbon Bottled in Bond 100 proof", ["bulleit-bottled-in-bond-111-22"]),
  assertConfirmationSet("Booker's 2025-02 By The Pond Batch", []),
  assertSelectionPolicy("Maximum two results at or above 90%",[0.96,0.92,0.91],["candidate-1","candidate-2"]),
  assertSelectionPolicy("Exactly 90% qualifies for the second choice",[0.94,0.90,0.89],["candidate-1","candidate-2"]),
  assertSelectionPolicy("Only one result between 80% and 90%",[0.89,0.88],["candidate-1"]),
  assertSelectionPolicy("No result below 80%",[0.79,0.78],[]),
  assertExcluded("Jefferson's Bourbon Blend of Straight Bourbon Whiskey", "olcc-13413b"),
  assertNoMatch("American Single Malt Whiskey"),
  assertNoConfidentMatch("Booker's 2025-02 By The Pond Batch"),
  assertNoConfidentMatch("Little Book The Infinite Edition II"),
  assertNoConfidentMatch("Knob Creek 21 Year Old Bourbon")
];

console.log(JSON.stringify({ ok: true, count: db.bottles.length, results }, null, 2));
