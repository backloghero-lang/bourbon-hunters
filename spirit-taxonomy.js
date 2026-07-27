(function(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.BH_SPIRITS = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  const BOURBON_STYLES = [
    { key: "standard", label: "Classic Bourbon" },
    { key: "small", label: "Small Batch" },
    { key: "single", label: "Single Barrel" },
    { key: "bib", label: "Bottled in Bond" },
    { key: "proof", label: "Barrel Proof" },
    { key: "wheated", label: "Wheated" },
    { key: "limited", label: "Limited" }
  ];

  const WHISKY_STYLES = [
    { key: "scotch", label: "Scotch" },
    { key: "irish", label: "Irish" },
    { key: "japanese", label: "Japanese" },
    { key: "rye", label: "Rye" },
    { key: "american_malt", label: "American Single Malt" },
    { key: "tennessee", label: "Tennessee" },
    { key: "canadian", label: "Canadian" },
    { key: "corn_wheat", label: "Corn & Wheat" },
    { key: "flavored", label: "Flavored Whiskey" },
    { key: "american_other", label: "American Whiskey" },
    { key: "world", label: "World Whisky" },
    { key: "other_whisky", label: "Other Whisky" }
  ];

  const US_REGIONS = new Set([
    "usa", "american", "united states", "alabama", "alaska", "arizona", "arkansas",
    "california", "colorado", "connecticut", "delaware", "florida", "georgia", "hawaii",
    "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine",
    "maryland", "massachusetts", "michigan", "minnesota", "mississippi", "missouri",
    "montana", "nebraska", "nevada", "new hampshire", "new jersey", "new mexico",
    "new york", "north carolina", "north dakota", "ohio", "oklahoma", "oregon",
    "pennsylvania", "rhode island", "south carolina", "south dakota", "tennessee",
    "texas", "utah", "vermont", "virginia", "washington", "west virginia",
    "wisconsin", "wyoming"
  ]);

  const WORLD_REGIONS = new Set([
    "australia", "austria", "belgium", "denmark", "england", "finland", "france",
    "germany", "iceland", "india", "israel", "italy", "mexico", "netherlands",
    "new zealand", "norway", "south africa", "spain", "sweden", "switzerland",
    "taiwan", "united kingdom", "wales"
  ]);

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\u0142/g, "l")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function fields(bottle) {
    const b = bottle || {};
    return {
      name: normalize(b.name),
      aliases: normalize((b.aliases || []).join(" ")),
      type: normalize(b.type),
      category: normalize(b.category),
      region: normalize(b.region),
      distillery: normalize(b.distillery),
      family: normalize(b.spirit_family),
      style: normalize(b.browse_style)
    };
  }

  function isBourbon(bottle) {
    const f = fields(bottle);
    if (f.family === "bourbon") return true;
    if (f.family === "whisky") return false;

    const name = `${f.name} ${f.aliases}`;
    const declaration = `${name} ${f.type} ${f.category}`;
    const explicitOther =
      /\b(scotch|irish|japanese|canadian|tennessee|single malt|malt whisk(?:e)?y|wheat whisk(?:e)?y|corn whisk(?:e)?y)\b/.test(declaration) ||
      (/\bmalt\b/.test(name) && !/\bbourbon\b/.test(name)) ||
      (/\brye\b/.test(name) && !/\bhigh rye\b/.test(name) && !/\bbourbon\b/.test(name)) ||
      (/\b(?:gin|vodka|rum|tequila|mezcal|moonshine)\b/.test(name) &&
        !/\bbourbon\b/.test(name) &&
        !/\b(?:finished|finish|cask|barrel)\b/.test(name));
    const flavored =
      /\b(?:apple|honey|peach|pineapple|orange|blackberry|black cherry|peanut butter|salted caramel|vanilla|chocolate|s ?mores|cinnamon)\b/.test(name) &&
      !/\b(?:finished|finish|cask|barrel)\b/.test(name);
    if (explicitOther || flavored || (/\bblend(?:ed)?\b/.test(name) && /\bbourbon\b/.test(name) && /\brye\b/.test(name))) return false;
    if (/\bbourbon|bourbn|brbn\b/.test(declaration)) return true;

    // OLCC often labels a bourbon only as "DOMESTIC WHISKEY". These stable
    // product families are bourbon unless the stronger rules above identify
    // rye, malt, Tennessee whiskey or a flavored expression.
    return /^(?:1792|ancient (?:ancient )?age|angel(?:s| s) envy|bardstown origin|bakers?|basil hayden(?:s| s)?|benchmark|bib (?:and )?tucker|blade (?:and )?bow|blantons?|blood oath|booker(?:s| s)?|buffalo trace|bulleit|bull run|calumet|eagle rare|e h taylor|elijah craig|evan williams|ezra brooks|fighting cock|four roses|frey ranch|george remus|heaven(?:s| s) door|heaven hill|henry mckenna|i w harper|isaac bowman|j t s brown|jefferson(?:s| s)?|jim beam|johnny drum|kentucky owl|kentucky tavern|knob creek|larceny|lux row|maker(?:s| s) mark|old bardstown|old charter|old crow|old ezra|old forester|old grand dad|old tub|penelope|rabbit hole|rebel|remus|stagg|thomas s moore|very old barton|w l weller|weller|wild turkey|woodford (?:reserve|res)|yellowstone)\b/.test(name);
  }

  function whiskyStyle(bottle) {
    const f = fields(bottle);
    if (WHISKY_STYLES.some(function(item) { return item.key === f.style; })) return f.style;
    const text = `${f.name} ${f.aliases} ${f.type} ${f.category}`;
    const all = `${text} ${f.region} ${f.distillery}`;

    if (/\b(scotch|scotland|islay|speyside|highland|lowland|campbeltown)\b/.test(all)) return "scotch";
    if (/\b(irish|ireland)\b/.test(all)) return "irish";
    if (/\b(japanese|japan|nikka|suntory|hibiki|hatozaki|tenjaku|yamazaki|hakushu|yoichi|miyagikyo)\b/.test(all)) return "japanese";
    if (/\b(canadian|canada)\b/.test(all)) return "canadian";
    if (/\bamerican single malt\b|\bstraight american single malt\b|\bsingle malt\b|\bmalt\b/.test(text) && (US_REGIONS.has(f.region) || /\bamerican\b|\bdomestic\b|\boregon\b|\bwashington\b|\btexas\b|\bcolorado\b|\bwestland\b|\bmccarthy s\b/.test(all))) return "american_malt";
    if (/\b(corn whisk(?:e)?y|straight corn|wheat whisk(?:e)?y|straight wheat|mellow corn|soft red wheat|wheat bib)\b/.test(text)) return "corn_wheat";
    if (/\b(straight rye|rye whisk(?:e)?y|rye bib|blended rye|rye|old overholt|rittenhouse|sagamore|sazerac|pikesville|whistlepig|templeton)\b/.test(text)) return "rye";
    if (/\btennessee\b|\bjack daniel(?:s| s)?\b|\bgeorge dickel\b|\bnearest green\b|\buncle nearest\b/.test(all)) return "tennessee";
    if (/\b(?:paul john)\b/.test(all)) return "world";
    if (/\b(?:apple|honey|peach|pineapple|orange|blackberry|black cherry|blueberry|strawberry|watermelon|banana|huckleberry|peanut butter|salted caramel|brown sugar|vanilla|chocolate|s ?mores|cinnamon|cream|fireball|sinfire|skrewball|southern comfort|howler head|ballotin)\b/.test(text) && !/\b(?:finished|finish|cask|barrel)\b/.test(text)) return "flavored";
    if (US_REGIONS.has(f.region) || /\b(american|domestic whiskey)\b/.test(`${f.type} ${f.region}`)) return "american_other";
    if (WORLD_REGIONS.has(f.region)) return "world";
    return "other_whisky";
  }

  function family(bottle) {
    return isBourbon(bottle) ? "bourbon" : "whisky";
  }

  function bourbonStyleKeys(bottle) {
    const f = fields(bottle);
    const text = `${f.name} ${f.aliases} ${f.type} ${f.category}`;
    const keys = [];
    if (/\b(single barrel|single cask|pojedyncza beczka)\b/.test(text)) keys.push("single");
    if (/\b(small batch|mala partia)\b/.test(text)) keys.push("small");
    if (/\b(bottled in bond|bottled in bond bib|bonded|bib)\b/.test(text)) keys.push("bib");
    if (/\b(barrel proof|barrel strength|cask strength|full proof|pelna moc beczki)\b/.test(text)) keys.push("proof");
    if (/\b(wheated|wheat recipe|wheat bourbon|bourbon pszeniczny)\b/.test(text)) keys.push("wheated");
    if (/\b(limited|special release|annual release|edycja limitowana)\b/.test(text)) keys.push("limited");
    if (!keys.length) keys.push("standard");
    return keys;
  }

  function styleKeys(bottle) {
    return family(bottle) === "bourbon" ? bourbonStyleKeys(bottle) : [whiskyStyle(bottle)];
  }

  function primaryStyle(bottle) {
    const keys = styleKeys(bottle);
    const priority = family(bottle) === "bourbon"
      ? ["bib", "proof", "single", "small", "wheated", "limited", "standard"]
      : WHISKY_STYLES.map(function(item) { return item.key; });
    return priority.find(function(key) { return keys.indexOf(key) >= 0; }) || keys[0] || "other_whisky";
  }

  function stylesForFamily(name) {
    return name === "whisky" ? WHISKY_STYLES.slice() : BOURBON_STYLES.slice();
  }

  function styleLabel(key) {
    const item = BOURBON_STYLES.concat(WHISKY_STYLES).find(function(entry) {
      return entry.key === key;
    });
    return item ? item.label : key;
  }

  function counts(records) {
    const result = { families: { bourbon: 0, whisky: 0 }, bourbon: {}, whisky: {} };
    (records || []).forEach(function(record) {
      const group = family(record);
      result.families[group]++;
      styleKeys(record).forEach(function(key) {
        result[group][key] = (result[group][key] || 0) + 1;
      });
    });
    return result;
  }

  return {
    version: "spirit-taxonomy-v2",
    BOURBON_STYLES,
    WHISKY_STYLES,
    normalize,
    family,
    whiskyStyle,
    styleKeys,
    primaryStyle,
    stylesForFamily,
    styleLabel,
    counts
  };
});
