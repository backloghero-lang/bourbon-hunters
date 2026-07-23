import { identityAscii } from "./catalog_identity.mjs";

export const RETAIL_FILTER_VERSION="retail-relevance-2026-v1";
export const MAX_RETAIL_USD=1000;

function numericPrice(value){
  const number=Number(value);
  return Number.isFinite(number)&&number>0?number:0;
}

export function retailPriceUsd(record){
  const price=numericPrice(record&&record.price);
  if(!price) return 0;
  const currency=String(record&&record.price_currency||"").toUpperCase();
  const source=identityAscii(record&&record.source);
  if(currency==="USD" || /woodencork|olcc/.test(source)) return price;
  if(currency==="PLN" || source==="domwhisky") return price/4;
  return 0;
}

function releaseYears(text){
  return [...text.matchAll(/\b(20\d{2})\b/g)].map((match)=>Number(match[1]));
}

function statedAge(text){
  const match=text.match(/\b(\d{2})\s*(?:year|years|yr|yrs|yo|letni|letnia|letnie)\b/);
  return match?Number(match[1]):0;
}

export function retailRemovalReason(record){
  const sourceText=[
    record&&record.name,record&&record.type,record&&record.category,record&&record.region
  ].filter(Boolean).join(" ");
  const text=identityAscii(sourceText);
  const raw=String(sourceText).toLowerCase();
  const priceUsd=retailPriceUsd(record);
  if(priceUsd>MAX_RETAIL_USD) return "price-over-1000-usd";

  const ultraAllocated=/\b(?:pappy van winkles?|van winkle|old rip van winkle|william larue weller|thomas h handy|george t stagg|eagle rare 17|double eagle very rare|king of kentucky|old forester birthday bourbon|michters (?:20|25)(?: year)?|ofc vintage|parker(?:s| s) heritage|weller millennium|daniel weller)\b/;
  if(ultraAllocated.test(text)) return "ultra-allocated";

  const luxury=/\b(?:baccarat|lalique|crystal decanter|luxury decanter|karuizawa|hanyu|port ellen|brora|macallan m black|macallan m|macallan no 6|macallan reflexion|macallan the reach|macallan time space|macallan horizon|macallan distil your world|macallan tree of life|macallan diamonds are forever|macallan master of photography|macallan of fifties|macallan folio|macallan edition no|macallan (?:40|60|79)|yamazaki mizunara|bowmore arc)\b/;
  if(luxury.test(text)) return "luxury-collector-release";

  const age=statedAge(text);
  const american=/\b(?:bourbon|american|tennessee|kentucky|straight rye)\b/.test(text);
  const japanese=/\b(?:japan|japanese|yamazaki|hakushu|hibiki|chichibu|karuizawa)\b/.test(text);
  if(age>=25 || (american&&age>=18) || (japanese&&age>=18)) return "high-age-collector-release";

  const years=releaseYears(text);
  if(years.some((year)=>year>=2000&&year<=2022)) return "historic-dated-release";
  if(/\b19\d{2}\b/.test(text)&&/\b(?:vintage|single cask|cask|distilled|bowmore|macallan)\b/.test(text)) return "historic-dated-release";

  const oneOff=/\b(?:selected by|hand selected by|selection for|private barrel|private cask|store pick|barrel pick|member exclusive|society exclusive|charity|festival exclusive|travel exclusive)\b/;
  if(oneOff.test(text)) return "private-or-event-release";
  if(/\b(?:barrel|cask)\s*(?:no\.?|number|#|n)\s*[:.#-]?\s*\d+\b/i.test(raw)) return "numbered-barrel-or-cask";

  const staleEdition=/\b(?:limited edition|limited release|commemorative|anniversary|holiday edition|birthday bourbon|annual release|special release|vintage|single cask)\b/;
  if(staleEdition.test(text)&&years.some((year)=>year<=2024)) return "stale-limited-release";

  const unverifiedLimited=record&&record.catalog_status!=="verified"&&staleEdition.test(text);
  if(unverifiedLimited) return "unverified-limited-label";

  const oldBatch=/\b(?:batch|release)\s*(?:no\s*)?(?:20|21|22|23)[a-z]?\b/;
  if(oldBatch.test(text)) return "old-batch-release";

  return "";
}
