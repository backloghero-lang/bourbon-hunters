import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const indexPath = path.join(root, "index.html");
const dbPath = path.join(root, "db", "bourbons.json");
const profilesPath = path.join(root, "db", "profiles-runtime.json");

const index = fs.readFileSync(indexPath, "utf8");
const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));

const idsBlock = index.slice(
  index.indexOf("const RUNTIME_BOTTLE_IDS"),
  index.indexOf("];", index.indexOf("const RUNTIME_BOTTLE_IDS"))
);
const runtimeIds = [...idsBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const runtimeSet = new Set(runtimeIds);

function clean(v) {
  return String(v || "").replace(/\s+/g, " ").trim();
}

function ascii(v) {
  return clean(v)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0142/g, "l")
    .replace(/-/g, " ");
}

function hash(v) {
  let h = 0;
  for (const ch of String(v)) h = (Math.imul(31, h) + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function pick(list, seed, offset = 0) {
  return list[(hash(seed) + offset) % list.length];
}

function categoryKey(b) {
  const c = ascii(b.category);
  const ty = ascii(b.type);
  if (c === "pojedyncza beczka") return "single";
  if (c === "mala partia") return "small";
  if (c === "pelna moc beczki") return "proof";
  if (c === "bottled in bond") return "bib";
  if (c === "edycja limitowana") return "limited";
  if (ty.includes("rye") || c.includes("rye")) return "rye";
  return "standard";
}

function styleName(key) {
  return {
    standard: "bourbon",
    single: "single barrel bourbon",
    small: "small batch bourbon",
    proof: "barrel proof bourbon",
    bib: "Bottled in Bond bourbon",
    rye: "rye whiskey",
    limited: "limited release bourbon"
  }[key] || "bourbon";
}

function plStyleName(key) {
  return {
    standard: "bourbon",
    single: "single barrel bourbon",
    small: "small batch bourbon",
    proof: "bourbon o mocy beczki",
    bib: "Bottled in Bond bourbon",
    rye: "rye whiskey",
    limited: "edycja limitowana bourbona"
  }[key] || "bourbon";
}

function proofTier(b) {
  const proof = Number(String(b.proof || "").replace(/[^0-9.]/g, ""));
  if (proof >= 115) return "high";
  if (proof >= 100) return "bold";
  if (proof > 0 && proof < 90) return "soft";
  return "classic";
}

function brandFamily(b) {
  const s = ascii(`${b.name} ${b.distillery}`);
  if (s.includes("buffalo trace") || s.includes("eagle rare") || s.includes("stagg") || s.includes("weller")) return "buffalo";
  if (s.includes("russell") || s.includes("wild turkey")) return "wildturkey";
  if (s.includes("four roses")) return "fourroses";
  if (s.includes("maker")) return "makers";
  if (s.includes("woodford")) return "woodford";
  if (s.includes("elijah craig") || s.includes("heaven hill")) return "heavenhill";
  if (s.includes("knob creek") || s.includes("beam")) return "beam";
  if (s.includes("bardstown")) return "bardstown";
  if (s.includes("michter")) return "michters";
  if (s.includes("old forester")) return "oldforester";
  if (s.includes("willett")) return "willett";
  return "classic";
}

const familyNotes = {
  buffalo: {
    en: ["vanilla", "caramel", "orange peel", "polished oak"],
    pl: ["wanilia", "karmel", "sk\u00f3rka pomara\u0144czy", "wyg\u0142adzony d\u0105b"]
  },
  wildturkey: {
    en: ["toffee", "rye spice", "orange zest", "charred oak"],
    pl: ["toffi", "\u017cytnia przyprawa", "sk\u00f3rka pomara\u0144czy", "opalany d\u0105b"]
  },
  fourroses: {
    en: ["red fruit", "honey", "floral spice", "soft oak"],
    pl: ["czerwone owoce", "mi\u00f3d", "kwiatowa przyprawa", "\u0142agodny d\u0105b"]
  },
  makers: {
    en: ["wheat sweetness", "vanilla cream", "caramel", "gentle oak"],
    pl: ["pszeniczna s\u0142odycz", "krem waniliowy", "karmel", "\u0142agodny d\u0105b"]
  },
  woodford: {
    en: ["dried fruit", "cocoa", "toasted oak", "baking spice"],
    pl: ["suszone owoce", "kakao", "pra\u017cony d\u0105b", "przyprawy korzenne"]
  },
  heavenhill: {
    en: ["peanut brittle", "caramel", "oak spice", "vanilla"],
    pl: ["orzechowy karmel", "karmel", "d\u0119bowa przyprawa", "wanilia"]
  },
  beam: {
    en: ["roasted peanut", "vanilla", "brown sugar", "dry oak"],
    pl: ["pra\u017cony orzech", "wanilia", "br\u0105zowy cukier", "suchy d\u0105b"]
  },
  bardstown: {
    en: ["honeyed grain", "caramel", "orchard fruit", "polished oak"],
    pl: ["miodowe zbo\u017ce", "karmel", "owoce sadu", "wyg\u0142adzony d\u0105b"]
  },
  michters: {
    en: ["butterscotch", "dark sugar", "oak", "warm spice"],
    pl: ["ma\u015blany karmel", "ciemny cukier", "d\u0105b", "ciep\u0142e przyprawy"]
  },
  oldforester: {
    en: ["banana bread", "brown sugar", "oak", "pepper spice"],
    pl: ["chlebek bananowy", "br\u0105zowy cukier", "d\u0105b", "pieprzna przyprawa"]
  },
  willett: {
    en: ["herbal spice", "caramel", "mint", "dry oak"],
    pl: ["zio\u0142owa przyprawa", "karmel", "mi\u0119ta", "suchy d\u0105b"]
  },
  classic: {
    en: ["vanilla", "caramel", "sweet oak", "baking spice"],
    pl: ["wanilia", "karmel", "s\u0142odki d\u0105b", "przyprawy korzenne"]
  }
};

const enAccents = [
  "a light toasted-sugar lift",
  "a touch of citrus brightness",
  "a darker barrel-char edge",
  "a softer honeyed middle",
  "a drier spice thread",
  "a rounded dessert-spice note"
];

const plAccents = [
  "lekki akcent pra\u017conego cukru",
  "odrobina cytrusowej jasno\u015bci",
  "ciemniejszy ton opalonej beczki",
  "\u0142agodniejszy, miodowy \u015brodek",
  "bardziej wytrawna ni\u0107 przypraw",
  "zaokr\u0105glona nuta deserowych przypraw"
];

const enTextures = [
  "polished and approachable",
  "fuller and more oak-forward",
  "sweet first, then spice-led",
  "compact, clean and classic",
  "richer through the middle",
  "drying as the oak takes over"
];

const plTextures = [
  "wyg\u0142adzony i przyst\u0119pny",
  "pe\u0142niejszy i mocniej d\u0119bowy",
  "najpierw s\u0142odki, potem przyprawowy",
  "zwarty, czysty i klasyczny",
  "bogatszy w \u015brodkowej cz\u0119\u015bci",
  "bardziej wytrawny, gdy przejmuje go d\u0105b"
];

function joinNotes(items) {
  return `${items[0]}, ${items[1]}, ${items[2]} and ${items[3]}`;
}

function joinNotesPl(items) {
  return `${items[0]}, ${items[1]}, ${items[2]} i ${items[3]}`;
}

function enProfile(b) {
  const key = categoryKey(b);
  const tier = proofTier(b);
  const family = familyNotes[brandFamily(b)].en;
  const name = clean(b.name);
  const distillery = clean(b.distillery) || "its producer";
  const proof = clean(b.proof);
  const proofText = proof ? ` at ${proof} proof` : "";
  const style = styleName(key);
  const intensity = tier === "high" ? "high-strength" : tier === "bold" ? "fuller-proof" : tier === "soft" ? "softer" : "classic";
  const accent = pick(enAccents, b.id, 1);
  const texture = pick(enTextures, b.id, 2);
  return {
    general: `${name} is a ${intensity} ${style} from ${distillery}${proofText}, profiled from the bottle data and known house style.`,
    nose: `${name} opens with ${joinNotes(family)}, plus ${accent}.`,
    taste: key === "rye"
      ? `${name} is spice-led on the palate, balancing rye grain, caramel sweetness and a drier oak structure.`
      : `${name} feels ${texture} on the palate, carrying ${family[1]}, ${family[3]} and rounded vanilla sweetness.`,
    finish: tier === "high"
      ? `${name} finishes long and warming, with oak spice, dark sweetness and lingering barrel heat.`
      : tier === "bold"
        ? `${name} finishes steady and warm, leaving oak, caramel and spice after the sweetness fades.`
        : `${name} finishes balanced and moderate, with vanilla, oak and gentle spice trailing off cleanly.`
  };
}

function plProfile(b) {
  const key = categoryKey(b);
  const tier = proofTier(b);
  const family = familyNotes[brandFamily(b)].pl;
  const name = clean(b.name);
  const distillery = clean(b.distillery) || "producenta";
  const proof = clean(b.proof);
  const proofText = proof ? ` przy ${proof} proof` : "";
  const style = plStyleName(key);
  const intensity = tier === "high" ? "mocniejszy" : tier === "bold" ? "pe\u0142niejszy" : tier === "soft" ? "\u0142agodniejszy" : "klasyczny";
  const accent = pick(plAccents, b.id, 1);
  const texture = pick(plTextures, b.id, 2);
  return {
    general: `${name} to ${intensity} ${style} od ${distillery}${proofText}, opisany na podstawie danych butelki i stylu producenta.`,
    nose: `W aromacie ${name} pojawiaj\u0105 si\u0119 ${joinNotesPl(family)}, do tego ${accent}.`,
    taste: key === "rye"
      ? `Na podniebieniu ${name} prowadzi przyprawa \u017cyta, karmel i bardziej wytrawna struktura d\u0119bu.`
      : `Na podniebieniu ${name} jest ${texture}, z ${family[1]}, ${family[3]} i zaokr\u0105glon\u0105 waniliow\u0105 s\u0142odycz\u0105.`,
    finish: tier === "high"
      ? `Finisz ${name} jest d\u0142ugi i rozgrzewaj\u0105cy, z d\u0119bow\u0105 przypraw\u0105, ciemn\u0105 s\u0142odycz\u0105 i ciep\u0142em beczki.`
      : tier === "bold"
        ? `Finisz ${name} jest stabilny i ciep\u0142y, zostawiaj\u0105c d\u0105b, karmel i przyprawy po wyga\u015bni\u0119ciu s\u0142odyczy.`
        : `Finisz ${name} jest zbalansowany i \u015bredni, z wanili\u0105, d\u0119bem i \u0142agodn\u0105 przypraw\u0105.`
  };
}

const output = {
  schema: {
    version: 1,
    languages: ["en", "pl"],
    fields: ["general", "nose", "taste", "finish"],
    note: "Runtime profiles are structured app copy synthesized from bottle metadata and listed source URLs; do not copy source text verbatim."
  },
  profiles: {}
};

let updated = 0;
for (const bottle of db.bottles || []) {
  if (!runtimeSet.has(bottle.id)) continue;
  output.profiles[bottle.id] = {
    profile: {
      en: enProfile(bottle),
      pl: plProfile(bottle)
    },
    meta: {
      status: "seeded_runtime_profile",
      method: "style_and_bottle_data_synthesis",
      sources: [bottle.url].filter(Boolean)
    }
  };
  updated++;
}

fs.writeFileSync(profilesPath, JSON.stringify(output, null, 2) + "\n", "utf8");
console.log(`Wrote ${updated} runtime profiles to ${path.relative(root, profilesPath)}.`);
