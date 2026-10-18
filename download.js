(function(){
  const link=document.getElementById("apkDownload");
  if(!link) return;
  let source="download-page";
  try{
    const value=new URLSearchParams(location.search).get("source")||"";
    if(/^[a-z0-9_-]{1,40}$/i.test(value)) source=value.toLowerCase();
  }catch(e){}
  link.href="https://bourbon-hunters.darekmaslyk.workers.dev/downloads/android?source="+encodeURIComponent(source);
  // na Androidzie sekcja dla komputera jest zbedna; na komputerze pokazujemy ja przed przyciskiem APK
  const desktop=document.getElementById("desktopHelp");
  if(!desktop) return;
  if(/Android/i.test(navigator.userAgent||"")) desktop.hidden=true;
  else link.parentNode.insertBefore(desktop,link);
})();
