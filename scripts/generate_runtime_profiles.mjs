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

const enNoseModifiers = [
  "clean grain sweetness",
  "dry baking spice",
  "a light floral lift",
  "a toasted barrel edge",
  "soft brown sugar",
  "a compact citrus snap",
  "a richer char note",
  "a mellow honey tone",
  "a dusty oak accent",
  "a warm pastry note",
  "a gentle herbal touch",
  "a polished vanilla core"
];

const plNoseModifiers = [
  "czysta s\u0142odycz zbo\u017ca",
  "sucha przyprawa korzenna",
  "lekka kwiatowa nuta",
  "akcent pra\u017conej beczki",
  "\u0142agodny br\u0105zowy cukier",
  "kr\u00f3tki cytrusowy b\u0142ysk",
  "bogatsza nuta opalenia",
  "mi\u0119kki ton miodu",
  "pylisty akcent d\u0119bu",
  "ciep\u0142a nuta wypieku",
  "\u0142agodny zio\u0142owy dotyk",
  "wyg\u0142adzony rdze\u0144 wanilii"
];

const enTasteModifiers = [
  "the sweetness stays controlled",
  "the oak keeps the sip structured",
  "spice arrives without turning sharp",
  "the middle stays rounded",
  "barrel notes add grip",
  "the grain note keeps it clear",
  "sweetness and oak stay in balance",
  "the texture stays compact",
  "warm spice fills the middle",
  "the caramel note stays clean",
  "a dry edge tightens the sip",
  "vanilla softens the oak"
];

const plTasteModifiers = [
  "s\u0142odycz pozostaje pod kontrol\u0105",
  "d\u0105b trzyma struktur\u0119 \u0142yku",
  "przyprawy nie robi\u0105 si\u0119 ostre",
  "\u015brodek pozostaje zaokr\u0105glony",
  "nuty beczki dodaj\u0105 chwytu",
  "zbo\u017ce utrzymuje czysty profil",
  "s\u0142odycz i d\u0105b zostaj\u0105 w r\u00f3wnowadze",
  "tekstura pozostaje zwarta",
  "ciep\u0142e przyprawy wype\u0142niaj\u0105 \u015brodek",
  "karmel pozostaje czysty",
  "wytrawna kraw\u0119d\u017a porz\u0105dkuje \u0142yk",
  "wanilia \u0142agodzi d\u0105b"
];

const enFinishShapes = [
  "with a clean fade",
  "with a dry final edge",
  "with a rounded last impression",
  "with a short spice echo",
  "with a polished oak return",
  "with a soft sweet close",
  "with a tidy barrel grip",
  "with a warm final pulse",
  "with a measured oak fade",
  "with a calm vanilla return",
  "with a compact dry close",
  "with a lingering spice trace"
];

const plFinishShapes = [
  "z czystym wygasaniem",
  "z wytrawn\u0105 ko\u0144c\u00f3wk\u0105",
  "z zaokr\u0105glonym ostatnim wra\u017ceniem",
  "z kr\u00f3tkim echem przypraw",
  "z powrotem wyg\u0142adzonego d\u0119bu",
  "z mi\u0119kkim s\u0142odkim domkni\u0119ciem",
  "ze zwartym chwytem beczki",
  "z ciep\u0142ym ko\u0144cowym pulsem",
  "z miarowym wygasaniem d\u0119bu",
  "ze spokojnym powrotem wanilii",
  "ze zwartym wytrawnym domkni\u0119ciem",
  "z d\u0142u\u017cszym \u015bladem przypraw"
];

const enFinishDetails = [
  "soft barrel spice and a clean vanilla trail",
  "dry oak, caramel warmth and a light cinnamon lift",
  "toasted sugar, gentle oak and a calm spice fade",
  "vanilla cream, polished wood and a light pepper touch",
  "brown sugar, oak grip and a measured sweet fade",
  "caramelized grain, baking spice and mellow barrel heat",
  "orange peel, toasted oak and a clean drying edge",
  "honeyed sweetness, oak tannin and a short spice echo",
  "dark caramel, vanilla and a tidy oak close",
  "sweet grain, clove warmth and a rounded oak finish",
  "maple-like sweetness, dry wood and soft char",
  "light cocoa, barrel spice and a balanced vanilla return",
  "baked sugar, oak polish and a gentle pepper snap",
  "toffee, warm spice and a smooth drying close",
  "vanilla, leathered oak and a quiet toasted note",
  "caramel, nutmeg and a compact barrel-spice fade"
];

const plFinishDetails = [
  "\u0142agodn\u0105 przypraw\u0105 beczki i czystym \u015bladem wanilii",
  "suchym d\u0119bem, ciep\u0142em karmelu i lekkim cynamonem",
  "pra\u017conym cukrem, \u0142agodnym d\u0119bem i spokojnym wygasaniem przypraw",
  "kremem waniliowym, wyg\u0142adzonym drewnem i lekkim pieprzem",
  "br\u0105zowym cukrem, d\u0119bowym chwytem i miarowym s\u0142odkim zej\u015bciem",
  "karmelizowanym ziarnem, przyprawami korzennymi i ciep\u0142em beczki",
  "sk\u00f3rk\u0105 pomara\u0144czy, pra\u017conym d\u0119bem i czyst\u0105 wytrawno\u015bci\u0105",
  "miodow\u0105 s\u0142odycz\u0105, tanin\u0105 d\u0119bu i kr\u00f3tkim echem przypraw",
  "ciemnym karmelem, wanili\u0105 i uporz\u0105dkowanym d\u0119bowym zamkni\u0119ciem",
  "s\u0142odkim ziarnem, ciep\u0142em go\u017adzika i zaokr\u0105glonym d\u0119bem",
  "klonow\u0105 s\u0142odycz\u0105, suchym drewnem i \u0142agodnym opaleniem",
  "lekkim kakao, przypraw\u0105 beczki i powrotem wanilii",
  "pieczonym cukrem, wyg\u0142adzonym d\u0119bem i delikatnym pieprzem",
  "toffi, ciep\u0142ymi przyprawami i g\u0142adkim wytrawnym domkni\u0119ciem",
  "wanili\u0105, dojrzalszym d\u0119bem i cich\u0105 nut\u0105 tostow\u0105",
  "karmelem, ga\u0142k\u0105 muszkato\u0142ow\u0105 i zwartym echem beczki"
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
  const proofNote = proof ? ` in its ${proof} proof frame` : "";
  const style = styleName(key);
  const intensity = tier === "high" ? "high-strength" : tier === "bold" ? "fuller-proof" : tier === "soft" ? "softer" : "classic";
  const accent = pick(enAccents, b.id, 1);
  const texture = pick(enTextures, b.id, 2);
  const finish = pick(enFinishDetails, b.id, 3);
  const noseMod = pick(enNoseModifiers, b.id, 4);
  const tasteMod = pick(enTasteModifiers, b.id, 5);
  const finishShape = pick(enFinishShapes, b.id, 6);
  const finishAnchor = `${family[0]} and ${family[2]}`;
  const finishProof = proof ? ` at ${proof} proof` : ` in a ${style} frame`;
  return {
    general: `${name} is a ${intensity} ${style} from ${distillery}${proofText}, built around the producer's house style and the bottle's strength.`,
    nose: `Vanilla-led aromas bring ${joinNotes(family)}, plus ${accent} and ${noseMod}${proofNote}.`,
    taste: key === "rye"
      ? `Spice leads the palate, balancing rye grain, caramel sweetness and a drier oak structure; ${tasteMod}${proofNote}.`
      : `The palate feels ${texture}, carrying ${family[1]}, ${family[3]} and rounded vanilla sweetness; ${tasteMod}${proofNote}.`,
    finish: tier === "high"
      ? `Long, warming finish with ${finish}, ${finishAnchor} and lingering barrel heat${finishProof}, ${finishShape}.`
      : tier === "bold"
        ? `Steady, warm finish with ${finish}, ${finishAnchor} after the sweetness fades${finishProof}, ${finishShape}.`
        : `Balanced medium finish with ${finish}, ${finishAnchor}${finishProof}, ${finishShape}.`
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
  const proofNote = proof ? ` w ramie ${proof} proof` : "";
  const style = plStyleName(key);
  const intensity = tier === "high" ? "mocniejszy" : tier === "bold" ? "pe\u0142niejszy" : tier === "soft" ? "\u0142agodniejszy" : "klasyczny";
  const accent = pick(plAccents, b.id, 1);
  const texture = pick(plTextures, b.id, 2);
  const finish = pick(plFinishDetails, b.id, 3);
  const noseMod = pick(plNoseModifiers, b.id, 4);
  const tasteMod = pick(plTasteModifiers, b.id, 5);
  const finishShape = pick(plFinishShapes, b.id, 6);
  const finishAnchor = `${family[0]} i ${family[2]}`;
  const finishProof = proof ? ` przy ${proof} proof` : ` w ramie stylu ${style}`;
  return {
    general: `${name} to ${intensity} ${style} od ${distillery}${proofText}, zbudowany wok\u00f3\u0142 stylu producenta i mocy tej butelki.`,
    nose: `Aromat prowadzi zestaw: ${joinNotesPl(family)}, do tego ${accent} oraz ${noseMod}${proofNote}.`,
    taste: key === "rye"
      ? `Na podniebieniu prowadzi przyprawa \u017cyta, karmel i bardziej wytrawna struktura d\u0119bu; ${tasteMod}${proofNote}.`
      : `Na podniebieniu profil jest ${texture}; w tle s\u0105 ${family[1]}, ${family[3]} i zaokr\u0105glona waniliowa s\u0142odycz; ${tasteMod}${proofNote}.`,
    finish: tier === "high"
      ? `D\u0142ugi, rozgrzewaj\u0105cy finisz z ${finish}, ${finishAnchor} i ciep\u0142em beczki${finishProof}, ${finishShape}.`
      : tier === "bold"
        ? `Stabilny, ciep\u0142y finisz zostawia ${finish}, ${finishAnchor} po wyga\u015bni\u0119ciu s\u0142odyczy${finishProof}, ${finishShape}.`
        : `Zbalansowany, \u015bredni finisz z ${finish}, ${finishAnchor}${finishProof}, ${finishShape}.`
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
