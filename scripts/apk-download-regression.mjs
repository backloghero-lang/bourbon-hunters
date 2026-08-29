import assert from "node:assert/strict";
import {existsSync,readFileSync,statSync} from "node:fs";

const root=new URL("../",import.meta.url);
const worker=readFileSync(new URL("agent/worker.js",root),"utf8");
const migration=readFileSync(new URL("agent/d1-migration-v76-apk-downloads.sql",root),"utf8");
const workflow=readFileSync(new URL(".github/workflows/deploy-pages.yml",root),"utf8");
const page=readFileSync(new URL("download.html",root),"utf8");
const apkUrl=new URL("downloads/Bourbon-Hunters-demo.apk",root);

assert.ok(existsSync(apkUrl),"Stable demo APK is missing");
assert.ok(statSync(apkUrl).size>1_000_000,"Demo APK is unexpectedly small");
assert.match(migration,/CREATE TABLE IF NOT EXISTS app_download_stats/);
assert.match(worker,/path==="\/downloads\/android"/);
assert.match(worker,/INSERT INTO app_download_stats/);
assert.match(worker,/Content-Disposition/);
assert.match(worker,/Bourbon-Hunters-demo\.apk\?release=0\.1\.4-linkedin-demo/);
assert.match(worker,/fetch\(APK_DOWNLOAD_URL,\{cache:"no-store"\}\)/);
assert.match(workflow,/cp downloads\/Bourbon-Hunters-demo\.apk _site\/downloads\//);
assert.match(page,/bourbon-hunters\.darekmaslyk\.workers\.dev\/downloads\/android\?source=download-page/);

const workerModule=await import(new URL("agent/worker.js?apk-download-test=1",root));
const writes=[];
const env={
  DB:{
    prepare(sql){
      const statement={
        args:[],
        bind(...args){ this.args=args; return this; },
        async first(){ return sql.includes("sqlite_master")?{name:"app_download_stats"}:null; },
        async run(){ writes.push({sql,args:this.args}); return {success:true}; }
      };
      return statement;
    }
  }
};
const pending=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>new Response(new Uint8Array([1,2,3,4]),{status:200,headers:{"Content-Length":"4","Content-Type":"application/vnd.android.package-archive"}});
let response;
try{
  response=await workerModule.default.fetch(
    new Request("https://worker.test/downloads/android?source=linkedin"),
    env,
    {waitUntil(promise){ pending.push(promise); }}
  );
  await Promise.all(pending);
}finally{
  globalThis.fetch=originalFetch;
}

assert.equal(response.status,200);
assert.equal(response.headers.get("Content-Disposition"),'attachment; filename="Bourbon-Hunters-demo.apk"');
assert.equal((await response.arrayBuffer()).byteLength,4);
assert.equal(writes.length,1);
assert.equal(writes[0].args[1],"linkedin");

console.log(JSON.stringify({ok:true,apk_bytes:statSync(apkUrl).size,tracking:"aggregate-d1",worker_stream:true},null,2));
