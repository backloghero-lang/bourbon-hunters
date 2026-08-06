import fs from "node:fs";
import vm from "node:vm";

let source=fs.readFileSync(new URL("../agent/worker.js",import.meta.url),"utf8");
if(!source.includes('const newsUser=await authUser(env,request)') || !source.includes('if(!newsUser) return J({error:"unauthorized"},401,cors)')){
  throw new Error("News endpoint must require an authenticated user");
}
source=source.replace("export default {","globalThis.__workerDefault={");
source+="\nglobalThis.__newsTest={canonicalNewsUrl,newsSourceForUrl,newsMetaValue,newsCanonicalFromHtml,newsReleaseSlot,newsLinksFromIndex,STARTER_NEWS,NEWS_DISCOVERY_PAGES,NEWS_RETENTION_DAYS,NEWS_AGENT_VERSION};\n";
const context={URL,console,globalThis:null};
context.globalThis=context;
vm.runInNewContext(source,context,{filename:"worker.js"});

const api=context.__newsTest;
const clean=api.canonicalNewsUrl("https://www.whiskyadvocate.com/News/?utm_source=test&fbclid=abc#latest");
if(clean!=="https://whiskyadvocate.com/News") throw new Error("Canonical URL failed: "+clean);
if(api.canonicalNewsUrl("https://example.com/article")) throw new Error("Unapproved news source was accepted");
if(api.newsSourceForUrl("https://thewhiskeywash.com/story")!=="The Whiskey Wash") throw new Error("Source mapping failed");
if(api.newsSourceForUrl("https://distiller.com/articles/example")) throw new Error("Competing application source was accepted");
if(api.newsSourceForUrl("https://breakingbourbon.com/article/example")!=="Breaking Bourbon") throw new Error("Breaking Bourbon source mapping failed");
if(api.NEWS_DISCOVERY_PAGES.some((url)=>url.includes("distiller.com"))) throw new Error("Competing application is present in discovery pages");
if(api.NEWS_AGENT_VERSION!=="whisky-news-source-first-v3-quota-fallback") throw new Error("Unexpected news agent version");

const links=api.newsLinksFromIndex(`
  <a href="/articles/new-release/">valid</a>
  <a href="https://distiller.com/articles/competitor">competitor</a>
  <a href="/category/scotch/">category</a>
`,"https://www.whiskymag.com/articles/");
if(links.length!==1 || links[0]!=="https://whiskymag.com/articles/new-release") throw new Error("Source-first link discovery failed: "+JSON.stringify(links));

const html=`<html><head>
  <link rel="canonical" href="https://www.whiskymag.com/articles/new-release/?utm_campaign=x">
  <meta property="og:title" content="A new &amp; useful whisky story">
  <meta property="og:image" content="https://cdn.example.test/image.jpg">
</head></html>`;
if(api.newsMetaValue(html,"og:title")!=="A new & useful whisky story") throw new Error("Metadata parsing failed");
if(api.newsCanonicalFromHtml(html,"https://www.whiskymag.com/articles/new-release/")!=="https://whiskymag.com/articles/new-release") throw new Error("HTML canonical parsing failed");
if(api.STARTER_NEWS.length!==6) throw new Error("Expected six starter news articles");
if(api.NEWS_RETENTION_DAYS!==30) throw new Error("News retention must be 30 days");
if(api.newsReleaseSlot(new Date("2026-08-02T12:00:00Z"))!=="2026-07-30") throw new Error("Sunday must use the Thursday release slot");
if(api.newsReleaseSlot(new Date("2026-08-03T00:00:00Z"))!=="2026-08-03") throw new Error("Monday must open a new release slot");
if(api.newsReleaseSlot(new Date("2026-08-05T23:59:00Z"))!=="2026-08-03") throw new Error("Wednesday must recover the Monday release slot");
if(api.newsReleaseSlot(new Date("2026-08-06T00:00:00Z"))!=="2026-08-06") throw new Error("Thursday must open a new release slot");
for(const article of api.STARTER_NEWS){
  if(!api.canonicalNewsUrl(article.url)) throw new Error("Starter URL is not approved: "+article.url);
  if(!article.excerpt_pl||!article.excerpt_en) throw new Error("Starter article is missing a bilingual summary");
}

console.log(JSON.stringify({ok:true,agent_version:api.NEWS_AGENT_VERSION,canonical:clean,sources:4,competitor_sources:0,starter_articles:api.STARTER_NEWS.length,retention_days:api.NEWS_RETENTION_DAYS},null,2));
