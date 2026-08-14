import fs from "node:fs";

const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const checks=[
  [!html.includes("function readLocalPreview("),"scanner no longer creates a full-size FileReader preview"],
  [html.includes("setShotPreview(URL.createObjectURL(f),true)"),"scanner previews the selected File through an object URL"],
  [html.includes("previewBlob:blob"),"scanner reuses the compressed blob for its final preview"],
  [html.includes("URL.revokeObjectURL(scanPreviewUrl)"),"scanner releases previous preview object URLs"],
  [html.includes("put({bottle_id:id,blob:blob,updated_at:"),"local bottle photos are stored as blobs"],
  [html.includes("item.data_url) legacy.push(saveLocalBottleImage"),"legacy base64 records migrate to blobs"],
  [html.includes("c.width=0; c.height=0"),"scanner canvas backing stores are released"],
  [html.includes("view.width=0; view.height=0"),"recognition canvas backing store is released"],
  [html.includes('new FormData()')&&html.includes('form.append("image"'),"scanner uploads binary multipart images instead of base64 JSON"],
  [html.includes('data.error==="bad json"')&&html.includes('legacyHeaders'),"scanner keeps a temporary compatibility retry for the previous Worker contract"]
];

for(const [ok,label] of checks){
  if(!ok) throw new Error(`Image memory regression: ${label}`);
}

console.log(`Image memory regression: ${checks.length} checks passed.`);
