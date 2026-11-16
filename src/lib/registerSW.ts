async function unregisterAppSw(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
      // Only touch our app SW paths; leave megsy-push-sw.js alone.
      if (/\/sw\.js(\?|$)/.test(url) || /\/service-worker\.js(\?|$)/.test(url)) {
        try { await r.unregister(); } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
}

export function registerAppServiceWorker(): void {
  if (typeof window === "undefined") return;
  // Remove the retired page-caching worker; fresh HTML and private reads always use the network.
  void unregisterAppSw().then(async () => {
    if (!("serviceWorker" in navigator) || window.location.hostname !== "app.ceyo.si") return;
    try {
      await navigator.serviceWorker.register("/ceyo-assets-sw.js", { scope: "/", updateViaCache: "none" });
    } catch { /* Offline first launch must not prevent the normal application boot. */ }
  });
}
