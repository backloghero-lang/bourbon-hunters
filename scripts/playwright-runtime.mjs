import { createRequire } from "node:module";

const modules=process.env.CODEX_NODE_MODULES||"C:/Users/masly/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const require=createRequire(modules.replace(/\\/g,"/")+"/bourbon-hunters-tests.js");
export const { chromium }=require("playwright");

export function browserLaunchOptions(){
  const options={headless:true};
  if(process.env.CHROME_PATH) options.executablePath=process.env.CHROME_PATH;
  else if(process.platform==="win32") options.executablePath="C:/Program Files/Google/Chrome/Application/chrome.exe";
  return options;
}
