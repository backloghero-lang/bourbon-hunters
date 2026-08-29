import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const root=path.resolve(import.meta.dirname,"..");
const worker=fs.readFileSync(path.join(root,"agent","worker.js"),"utf8");
const migration=fs.readFileSync(path.join(root,"agent","d1-migration-v70-scanner-budgets.sql"),"utf8");

function assert(condition,message){ if(!condition) throw new Error(message); }

assert(!worker.includes("env.DEV_KEY"),"DEV_KEY must not bypass scanner budgets");
assert(!worker.includes('const confirmationOnly=mode==="rate"&&!!confirmedId'),"confirmed_id bypass is still present");
assert(worker.includes('consumeScannerBudget(env,request,scanUser,deviceHash,"identify")'),"identify budget is missing");
assert(worker.includes('consumeScannerBudget(env,request,scanUser,deviceHash,"cutout")'),"cutout budget is missing");
assert(worker.includes('consumeScannerBudget(env,request,scanUser,deviceHash,"analysis")'),"analysis budget is missing");

const sqlMatch=worker.match(/env\.DB\.prepare\("(INSERT INTO scanner_budget_events[^\"]+)"\)/);
assert(sqlMatch,"Atomic budget INSERT was not found");
const insertSql=sqlMatch[1];

const db=new DatabaseSync(":memory:");
db.exec(migration);
const insert=db.prepare(insertSql);
const period="2026-08-06";

function consume({id,actor,ip,operation="identify",actorLimit=3,ipLimit=4}){
  return insert.run(id,period,"guest",actor,ip,operation,"2026-08-06T10:00:00.000Z",period,operation,actor,actorLimit,period,operation,ip,ipLimit).changes===1;
}

assert(consume({id:"a1",actor:"device-a",ip:"ip-home"}),"first actor use rejected");
assert(consume({id:"a2",actor:"device-a",ip:"ip-home"}),"second actor use rejected");
assert(consume({id:"a3",actor:"device-a",ip:"ip-home"}),"third actor use rejected");
assert(!consume({id:"a4",actor:"device-a",ip:"ip-home"}),"actor exceeded its limit");

assert(consume({id:"b1",actor:"rotated-device",ip:"ip-home"}),"shared IP should have one remaining use");
assert(!consume({id:"b2",actor:"another-device",ip:"ip-home"}),"device rotation bypassed the IP limit");

assert(consume({id:"c1",actor:"device-a",ip:"ip-home",operation:"cutout",actorLimit:2,ipLimit:10}),"separate cutout budget was not available");
assert(consume({id:"d1",actor:"device-a",ip:"ip-home",operation:"analysis",actorLimit:1,ipLimit:10}),"separate analysis budget was not available");
assert(!consume({id:"d2",actor:"device-a",ip:"ip-home",operation:"analysis",actorLimit:1,ipLimit:10}),"analysis limit was exceeded");

const rows=db.prepare("SELECT operation,COUNT(*) AS count FROM scanner_budget_events GROUP BY operation ORDER BY operation").all();
assert(rows.some((row)=>row.operation==="identify"&&row.count===4),"unexpected identify event count");
assert(rows.some((row)=>row.operation==="cutout"&&row.count===1),"unexpected cutout event count");
assert(rows.some((row)=>row.operation==="analysis"&&row.count===1),"unexpected analysis event count");

let runtimeSource=worker.replace("export default {","globalThis.__worker={");
runtimeSource+="\nglobalThis.__budgetTest={consumeScannerBudget,scannerDeveloperAccess};";
const context={console,fetch:async()=>new Response("",{status:503}),Response,Request,Headers,URL,TextEncoder,TextDecoder,Blob,crypto:webcrypto,atob,btoa,setTimeout,clearTimeout};
vm.runInNewContext(runtimeSource,context,{filename:"worker.js"});
const request=new Request("https://example.test/",{headers:{"CF-Connecting-IP":"203.0.113.7"}});
const adminBudget=await context.__budgetTest.consumeScannerBudget({},request,{id:"admin-1",is_admin:1},null,"identify");
assert(adminBudget.allowed&&adminBudget.owner&&adminBudget.remaining===null,"D1 admin should bypass the budget");
const developerBudget=await context.__budgetTest.consumeScannerBudget({DEV_SCANNER_DEVICE_HASHES:"other-device,developer-device"},request,null,"developer-device","identify");
assert(developerBudget.allowed&&developerBudget.owner&&developerBudget.remaining===null,"configured developer device should bypass the budget");
const missingSchema=await context.__budgetTest.consumeScannerBudget({},request,null,"device-hash","identify");
assert(!missingSchema.allowed&&missingSchema.error==="scanner_budget_schema_missing","ordinary actor must fail closed without v70");

console.log(JSON.stringify({
  ok:true,
  migration:"v70",
  atomic_insert:true,
  actor_limit_enforced:true,
  rotated_device_blocked_by_ip:true,
  independent_budgets:true,
  admin_unlimited:true,
  developer_device_unlimited:true,
  missing_schema_fails_closed:true,
  rows
},null,2));
