/** Android-app-only boot splash (Uiverse loader by Shoh2008). Never renders on the web. */
import { useEffect, useState } from "react";
import { isPlayApp } from "@/lib/native/playBilling";
import "@/styles/android-splash.css";

export function AndroidSplash() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!isPlayApp()) return;
    setShow(true);
    const t1 = setTimeout(() => setLeaving(true), 1400);
    const t2 = setTimeout(() => setShow(false), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  if (!show) return null;
  return (
    <div className={`android-splash${leaving ? " is-leaving" : ""}`} role="status" aria-label="Loading">
      <span className="android-splash-loader" />
    </div>
  );
}
