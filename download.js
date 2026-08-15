(function(){
  const link=document.getElementById("apkDownload");
  if(!link) return;
  let source="download-page";
  try{
    const value=new URLSearchParams(location.search).get("source")||"";
    if(/^[a-z0-9_-]{1,40}$/i.test(value)) source=value.toLowerCase();
  }catch(e){}
  link.href="https://bourbon-hunters.darekmaslyk.workers.dev/downloads/android?source="+encodeURIComponent(source);
})();
