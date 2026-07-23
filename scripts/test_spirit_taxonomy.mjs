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
  [{ name: "Westland Single Malt", type: "AMERICAN SINGLE MALT WHISKEY", region: "WASHINGTON" }, "whisky", "american_malt"]
];

for (const [bottle, expectedFamily, expectedStyle] of cases) {
  assert.equal(taxonomy.family(bottle), expectedFamily, bottle.name);
  assert.ok(taxonomy.styleKeys(bottle).includes(expectedStyle), bottle.name);
}

process.stdout.write(`Taxonomy tests passed: ${cases.length}\n`);
