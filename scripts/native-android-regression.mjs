import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root=new URL("../",import.meta.url);
const config=JSON.parse(readFileSync(new URL("capacitor.config.json",root),"utf8"));
const frontend=readFileSync(new URL("index.html",root),"utf8");
const worker=readFileSync(new URL("agent/worker.js",root),"utf8");
const manifest=readFileSync(new URL("android/app/src/main/AndroidManifest.xml",root),"utf8");
const activity=readFileSync(new URL("android/app/src/main/java/pl/bourbonhunters/app/MainActivity.java",root),"utf8");
const gradle=readFileSync(new URL("android/app/build.gradle",root),"utf8");
const bridge=readFileSync(new URL("mobile/native-bridge.js",root),"utf8");

assert.equal(config.webDir,"mobile-dist");
assert.equal(config.server,undefined,"Android APK must not load the remote GitHub Pages app as its shell");
assert.match(frontend,/bourbonhunters:\/\/auth\/google/);
assert.match(frontend,/BH_HANDLE_APP_URL/);
assert.match(frontend,/BH_HANDLE_NATIVE_BACK/);
assert.match(frontend,/BH_NATIVE\.openExternal/);
assert.match(worker,/candidate\.protocol==="bourbonhunters:"/);
assert.match(worker,/"https:\/\/localhost"/);
assert.match(manifest,/android:scheme="@string\/custom_url_scheme"/);
assert.match(manifest,/android:host="auth"/);
assert.match(activity,/BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE/);
assert.match(gradle,/versionCode 5/);
assert.match(gradle,/versionName "0\.1\.4-demo"/);
assert.match(bridge,/App\.addListener\("appUrlOpen"/);
assert.match(bridge,/App\.addListener\("backButton"/);

console.log(JSON.stringify({ok:true,web_dir:config.webDir,native_oauth:true,immersive:true},null,2));
