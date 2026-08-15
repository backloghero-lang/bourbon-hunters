import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "mobile-dist");
if (path.basename(target) !== "mobile-dist" || !target.startsWith(root + path.sep)) {
  throw new Error("Refusing to rebuild an unexpected mobile shell path.");
}

const copied = new Set();
async function exists(file) {
  try { await stat(file); return true; } catch { return false; }
}
async function copy(relative) {
  relative = relative.replaceAll("/", path.sep);
  if (copied.has(relative)) return;
  const source = path.join(root, relative);
  if (!(await exists(source))) return;
  const destination = path.join(target, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
  copied.add(relative);
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

const runtimeFiles = [
  "index.html",
  "spirit-taxonomy.js",
  "manifest.json",
  "sw.js",
  "sw-assets.generated.js",
  "db/bourbons.json",
  "db/profiles-runtime.json",
  "db/catalog/demo-200.json",
  "db/catalog/browse-meta.json",
  "db/catalog/dedupe-redirects.json"
];
const runtimeDirs = [
  "icons",
  "assets/brand",
  "assets/detail",
  "assets/fonts",
  "assets/intro",
  "assets/bourbons/list-thumbs",
  "assets/news",
  "assets/profile-badges",
  "design/figma-assets"
];
for (const file of runtimeFiles) await copy(file);
for (const dir of runtimeDirs) await copy(dir);

const textSources = [];
for (const file of runtimeFiles) {
  const absolute = path.join(root, file);
  if (await exists(absolute)) textSources.push(await readFile(absolute, "utf8"));
}
const assetPattern = /(?:assets|design|icons)\/[A-Za-z0-9_%+.,@()' -]+(?:\/[A-Za-z0-9_%+.,@()' -]+)*\.(?:avif|gif|jpe?g|mp4|png|svg|webp|woff2?|ttf)/gi;
for (const source of textSources) {
  for (const match of source.matchAll(assetPattern)) {
    let relative = match[0];
    try { relative = decodeURIComponent(relative); } catch {}
    await copy(relative);
  }
}

const bridgeParts = [
  "node_modules/@capacitor/core/dist/capacitor.js",
  "node_modules/@capacitor/app/dist/plugin.js",
  "node_modules/@capacitor/browser/dist/plugin.js",
  "mobile/native-bridge.js"
];
const bridge = (await Promise.all(bridgeParts.map((file) => readFile(path.join(root, file), "utf8")))).join("\n");
await writeFile(path.join(target, "native-bridge.js"), bridge, "utf8");

const indexPath = path.join(target, "index.html");
let index = await readFile(indexPath, "utf8");
index = index.replace(
  '<script src="spirit-taxonomy.js"></script>',
  '<script src="native-bridge.js"></script>\n<script src="spirit-taxonomy.js"></script>'
);
if (!index.includes('src="native-bridge.js"')) throw new Error("Native bridge injection failed.");
await writeFile(indexPath, index, "utf8");

async function sizeOf(dir) {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    total += entry.isDirectory() ? await sizeOf(file) : (await stat(file)).size;
  }
  return total;
}
const bytes = await sizeOf(target);
console.log(`Mobile shell ready: ${(bytes / 1024 / 1024).toFixed(1)} MB`);
