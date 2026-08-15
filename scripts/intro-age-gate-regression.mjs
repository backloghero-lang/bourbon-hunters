import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const finishGate=source.match(/const finishAgeGate=function\(\)\{([\s\S]*?)\n\s*\};/);
const bodyStart=source.indexOf("<body>");
const bootCover=source.indexOf('id="bhBootCover"');
const appRoot=source.indexOf('id="appRoot"');

assert.ok(finishGate,"Age gate completion handler is missing");
assert.ok(bodyStart<bootCover && bootCover<appRoot,"Boot cover must be painted before the app root");
assert.match(source,/\.boot-cover\{[^}]*position:fixed[^}]*inset:0[^}]*background:#000/);
assert.match(source,/gate\.classList\.add\("show"\);\s*hideBootCover\(\);/);
assert.ok(
  finishGate[1].indexOf("BH_START_INTRO")<finishGate[1].indexOf('gate.classList.remove("show")'),
  "Intro cover must be started before the age gate is hidden"
);
assert.match(source,/#bhIntro\.is-playing \.bh-intro-video video\{opacity:1\}/);
assert.match(source,/\.bh-intro-video video\{[^}]*opacity:0[^}]*pointer-events:none/);
assert.match(source,/disablepictureinpicture controlslist="nodownload noplaybackrate nofullscreen"/);
assert.match(source,/video\.addEventListener\("loadedmetadata",function\(\)\{\s*if\(!started \|\| done\) return;/);
assert.match(source,/intro\.classList\.add\("is-preparing"\)/);
assert.match(source,/intro\.classList\.add\("is-preparing"\);\s*hideBootCover\(\);/);
assert.doesNotMatch(source,/video\.load\(\)/);

console.log(JSON.stringify({ok:true,sequence:"native-black-boot-age-gate-intro-video",native_play_overlay_hidden:true},null,2));
