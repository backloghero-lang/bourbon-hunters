const Capacitor = window.Capacitor;
const App = window.capacitorApp && window.capacitorApp.App;
const Browser = window.capacitorBrowser && window.capacitorBrowser.Browser;
const isNative = Boolean(Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
let pendingUrl = "";

function deliverUrl(url) {
  if (!url) return;
  if (typeof window.BH_HANDLE_APP_URL === "function") {
    const next = url;
    pendingUrl = "";
    window.BH_HANDLE_APP_URL(next);
    return;
  }
  pendingUrl = url;
}

window.BH_NATIVE = {
  isNative,
  async openAuth(url) {
    if (!isNative) {
      window.location.href = url;
      return;
    }
    await Browser.open({ url, presentationStyle: "fullscreen" });
  },
  async openExternal(url) {
    if (!isNative) return false;
    await Browser.open({ url, presentationStyle: "fullscreen" });
    return true;
  },
  async closeBrowser() {
    if (!isNative) return;
    try { await Browser.close(); } catch (_) {}
  },
  takePendingUrl() {
    const url = pendingUrl;
    pendingUrl = "";
    return url;
  }
};

if (isNative && App && Browser) {
  App.addListener("appUrlOpen", async ({ url }) => {
    try { await Browser.close(); } catch (_) {}
    deliverUrl(url);
  });

  App.addListener("backButton", async ({ canGoBack }) => {
    let handled = false;
    if (typeof window.BH_HANDLE_NATIVE_BACK === "function") {
      handled = window.BH_HANDLE_NATIVE_BACK(Boolean(canGoBack)) === true;
    }
    if (!handled) await App.exitApp();
  });

  App.getLaunchUrl().then(({ url }) => deliverUrl(url)).catch(() => {});
}
