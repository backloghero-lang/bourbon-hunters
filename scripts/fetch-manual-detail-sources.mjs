import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const outputDir=path.join(root,"assets","bourbons","manual-detail");
const sources={
  "popular-benchmark-bonded.png":"https://www.totalwine.com/dynamic/x1000,sq/images/233446750/233446750-1-fr.png",
  "blantons-bourbon.png":"https://www.pngkit.com/png/full/247-2470226_blantons-single-barrel-bottle-blanton-bourbon-the-original.png",
  "popular-e-h-taylor-single-barrel.png":"https://images.gopuff.com/blob/gopuffcatalogstorageprod/catalog-images-container/resize/cf/version%3D1_2%2Cformat%3Dauto%2Cfit%3Dscale-down%2Cwidth%3D800%2Cheight%3D800/7147c175-5cd0-4b76-9def-de808cad19ae-padded.png",
  "popular-smoke-wagon-small-batch-bourbon.jpg":"https://lostcargo.com/wp-content/uploads/2023/05/smoke-wagon-small-batch-bourbon-bottle.jpg",
  "popular-fighting-cock-103-proof.png":"https://www.totalwine.com/dynamic/490x/media/sys_master/twmmedia/h42/he4/17159081623582.png",
  "popular-j-t-s-brown-bottled-in-bond.jpg":"https://www.instacart.com/image-server/1200x1200/www.instacart.com/assets/domains/product-image/file/large_1d0c4901-083b-470a-901c-9e8ac1e4b191.jpg",
  "popular-old-tub-bottled-in-bond.png":"https://www.totalwine.com/dynamic/x1000,sq/images/231560750/231560750-1-fr.png",
  "popular-coopers-craft-barrel-reserve-100-proof.jpg":"https://internetwines.com/cdn/shop/files/CoopersCraftBarrelRsvBrbn_900x.jpg?v=1752621640",
  "olcc-0346b.png":"https://flaviar.com/cdn/shop/files/Cutty-Sark-Blended-Scotch-Whisky-shadow_ca504601-c8ae-4f9a-a07d-199bd2d757ea.png?v=1761199950&width=1946",
  "popular-glenfiddich-18-year.webp":"https://albertwines2u.com.my/cdn/shop/files/Glenfiddich_18YearsOld_SingleMaltScotchWhiskyBottle.png?v=1751300190&width=2048",
  "olcc-0146b.png":"https://www.totalwine.com/dynamic/x1000,sq/images/1782750/1782750-1-fr.png",
  "popular-aberlour-a-bunadh.png":"https://cdn.pernod-ricard.cz/brand_data//1616505783_aberlour-a-bunadh-07l-foto-lahve.png",
  "olcc-9157b.png":"https://cdn.shopify.com/s/files/1/0416/5599/2469/files/Dareringer-bourbon.png?v=1696360248",
  "jeffersons-very-small-batch-bourbon.jpg":"https://i5.samsclubimages.com/asr/78446480-d665-44aa-aaae-405add199ec4.77f51572833f727633533cf538500b51.jpeg?odnBg=FFFFFF&odnHeight=1600&odnWidth=1600",
  "popular-caol-ila-12-year.jpg":"https://upload.wikimedia.org/wikipedia/commons/e/e4/Caol_Ila_Islay_Single_Malt_Whisky_aged_12_years.jpg",
  "olcc-0392b.png":"https://flaviar.com/cdn/shop/files/2020090814_glenfiddich_15_year_old_solera_reserve_shadow_original_43b4a63d-fb9d-4abe-804c-989a15396457.png?v=1761203982&width=1946",
  "popular-laphroaig-10-year.webp":"https://www.laphroaig.com/sites/default/files/styles/original/public/2024-12/Laphroaig_10YO-700ml_NewPackaging_Front_4688536.png.webp?itok=au5ZmQez",
  "popular-redbreast-12-year.png":"https://cdn.pernod-ricard.cz/brand_data//1638624485_redbreast-12yo-07l-foto-lahve.png",
  "popular-redbreast-15-year.jpg":"https://cdn.pernod-ricard.cz/brand_data//1727857122_redbreast-15yo-07l-foto-lahve.jpg",
  "popular-redbreast-12-year-cask-strength.jpg":"https://cdn.pernod-ricard.cz/brand_data//1742463475_redbreast-12yo-cask-strength-07l-foto-lahve.jpg",
  "popular-bowmore-12-year.webp":"https://www.bowmore.com/sites/default/files/styles/original/public/2025-06/Bowmore%2012%20Year%20Old%20Whisky%20Bottle_0.png.webp?itok=lZw32fbM",
  "popular-the-balvenie-12-year-doublewood-bottle.png":"https://www.totalwine.com/dynamic/x1000,sq/images/5484750/5484750-1-fr.png",
  "popular-the-glenallachie-12-year-1.png":"https://shop.theglenallachie.com/cdn/shop/files/12-year-old_medal_2.png?v=1751554613&width=1946",
};

fs.mkdirSync(outputDir,{recursive:true});
const failures=[];
for(const [filename,url] of Object.entries(sources)){
  try{
    const headers={"user-agent":"Mozilla/5.0 Bourbon Hunters demo image audit"};
    if(url.includes("diffordsguide.com")) headers.referer="https://www.diffordsguide.com/";
    const response=await fetch(url,{headers});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=Buffer.from(await response.arrayBuffer());
    if(data.length<10_000) throw new Error(`response too small (${data.length} bytes)`);
    fs.writeFileSync(path.join(outputDir,filename),data);
    console.log(`${filename}: ${data.length} bytes`);
  }catch(error){
    failures.push(`${filename}: ${error.message}`);
    console.error(failures.at(-1));
  }
}
if(failures.length) process.exitCode=1;
