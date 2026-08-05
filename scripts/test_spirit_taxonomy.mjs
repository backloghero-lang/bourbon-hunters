import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const taxonomy = require("../spirit-taxonomy.js");

const cases = [
  [{ name: "Maker's Mark 46 Kentucky Straight Bourbon Whisky", type: "Bourbon" }, "bourbon", "standard"],
  [{ name: "Weller Special Reserve", type: "Bourbon pszeniczny (wheated)" }, "bourbon", "wheated"],
  [{ name: "Jack Daniel's Bonded Tennessee Whiskey", region: "TENNESSEE", type: "DOMESTIC WHISKEY" }, "whisky", "tennessee"],
  [{ name: "Jack Daniel's Single Barrel Rye", region: "TENNESSEE", type: "STRAIGHT RYE WHISKY" }, "whisky", "rye"],
  [{ name: "Bulleit Rye Whiskey", type: "STRAIGHT RYE WHISKY", region: "KENTUCKY" }, "whisky", "rye"],
  [{ name: "Bulleit Bourbon High Rye Mash Bill", type: "STRAIGHT BOURBON WHISKY" }, "bourbon", "standard"],
  [{ name: "Ardbeg 10", type: "SINGLE MALT SCOTCH WHISKY", region: "SCOTLAND" }, "whisky", "scotch"],
  [{ name: "Redbreast 12", type: "IRISH WHISKY", region: "IRELAND" }, "whisky", "irish"],
  [{ name: "Hibiki Harmony", type: "WHISKY", region: "JAPAN" }, "whisky", "japanese"],
  [{ name: "Kavalan Classic", type: "WHISKY", region: "TAIWAN" }, "whisky", "world"],
  [{ name: "Westland Single Malt", type: "AMERICAN SINGLE MALT WHISKEY", region: "WASHINGTON" }, "whisky", "american_malt"],
  [{ name: "Basil Hayden's Two by Two Rye", type: "Bourbon" }, "whisky", "rye"],
  [{ name: "Woodford Reserve Kentucky Straight Wheat Whiskey", type: "Bourbon" }, "whisky", "corn_wheat"],
  [{ name: "Jim Beam Apple", type: "Bourbon" }, "whisky", "flavored"],
  [{ name: "1792 Small Batch Single Barrel Select", type: "DOMESTIC WHISKEY", category: "Whiskey" }, "bourbon", "single"],
  [{ name: "Bardstown Origin Bottled in Bond", type: "DOMESTIC WHISKEY", category: "Whiskey" }, "bourbon", "bib"],
  [{ name: "Bulleit Bottled in Bond", type: "DOMESTIC WHISKEY", category: "Whiskey" }, "bourbon", "bib"],
  [{ name: "BOOKERS", type: "DOMESTIC WHISKEY", category: "Whiskey" }, "bourbon", "standard"],
  [{ name: "Bull Run Barrel Strength BRBN", type: "DOMESTIC WHISKEY", category: "Whiskey" }, "bourbon", "proof"],
  [{ name: "Knob Creek Rye 7 Year", type: "DOMESTIC WHISKEY", category: "Whiskey" }, "whisky", "rye"],
  [{ name: "Jack Daniels Black Label", type: "DOMESTIC WHISKEY", category: "Whiskey" }, "whisky", "tennessee"],
  [{ name: "Jefferson's Reserve Bourbon Cask", type: "SCOTCH", category: "Scotch", region: "SCOTLAND" }, "whisky", "scotch"],
  [{ name: "Nikka Coffey Grain", type: "OTHER IMPORTED WHISKY" }, "whisky", "japanese"],
  [{ name: "Woodford Reserve Five-Malt Stouted Mash", type: "Bourbon", region: "USA" }, "whisky", "american_malt"],
  [{ name: "Four Roses Single Barrel Bottled in Bond", type: "Bourbon" }, "bourbon", "bib"]
];

for (const [bottle, expectedFamily, expectedStyle] of cases) {
  assert.equal(taxonomy.family(bottle), expectedFamily, bottle.name);
  assert.ok(taxonomy.styleKeys(bottle).includes(expectedStyle), bottle.name);
}

for (const bottle of [
  { name: "Jim Beam Apple", type: "Bourbon", abv: 32.5 },
  { name: "Wild Turkey American Honey", type: "Whiskey Liqueur", abv: 35.5 },
  { name: "Knob Creek Smoked Maple", type: "Whiskey", abv: 45 },
  { name: "Crown Royal Vanilla", type: "Flavored Whisky", abv: 35 },
  { name: "Fireball Dragon Reserve", type: "Whisky", abv: 33 }
]) {
  assert.equal(taxonomy.isFlavoredVariant(bottle), true, `${bottle.name} should be hidden as flavored`);
  assert.equal(taxonomy.isVisibleBottle(bottle), false, `${bottle.name} should not be visible`);
}

for (const bottle of [
  { name: "Angel's Envy Port Cask Finished Bourbon", type: "Bourbon", abv: 43.3 },
  { name: "Woodford Reserve Brandy Cask Finish", type: "Bourbon", abv: 45.2 },
  { name: "Casey Jones Maple Wood Finished Bourbon", type: "Bourbon", abv: 50 }
]) {
  assert.equal(taxonomy.isFlavoredVariant(bottle), false, `${bottle.name} is barrel-derived`);
  assert.equal(taxonomy.isVisibleBottle(bottle), true, `${bottle.name} should remain visible`);
}

assert.deepEqual(taxonomy.WHISKY_STYLES.map((style) => style.key), [
  "scotch", "irish", "japanese", "rye", "american_malt", "tennessee", "canadian", "corn_wheat", "american_other"
]);

process.stdout.write(`Taxonomy tests passed: ${cases.length}\n`);
