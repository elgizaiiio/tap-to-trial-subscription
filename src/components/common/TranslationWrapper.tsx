import { useEffect, type ReactNode } from "react";
import {
  getUserLang,
  initUserLang,
  setUserLang,
  isSupportedLang,
  useUserLang,
} from "@/lib/authI18n";
import {
  retranslateEgyptianDom,
  startEgyptianDom,
  stopEgyptianDom,
} from "@/lib/i18n/egyptianDom";
import { startInterfaceTranslation } from "@/lib/i18n/interfaceDom";
import { normalizeAppLanguage } from "@/lib/i18n/bundledLocales";

interface TranslationWrapperProps {
  children: ReactNode;
}

/**
 * Keeps <html lang/dir> in sync with the selected language and, when the user
 * is on المصري, applies the bundled Egyptian dictionary to the rendered UI.
 *
 * Interface dictionaries are bundled; runtime translation never contacts a service.
 */
const TranslationWrapper = ({ children }: TranslationWrapperProps) => {
  const lang = useUserLang();

  useEffect(() => {
    // A `/ar-eg` or `/en` route prefix wins over the stored preference.
    const routeLang = window.location.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
    if (routeLang && isSupportedLang(routeLang) && routeLang !== getUserLang()) {
      void setUserLang(routeLang, { syncRemote: false });
    } else {
      void initUserLang();
    }
    const onLanguage = (event: Event) => {
      const code = (event as CustomEvent<string>).detail;
      if (code === "system") { void initUserLang(); return; }
      const language = normalizeAppLanguage(code || "");
      if (language) void setUserLang(language, { syncRemote: false });
    };
    window.addEventListener("ceyo:language", onLanguage);
    return () => window.removeEventListener("ceyo:language", onLanguage);
  }, []);

  useEffect(() => {
    if (lang !== "ar-eg") {
      stopEgyptianDom();
      return lang === "en" ? undefined : startInterfaceTranslation(lang);
    }

    startEgyptianDom();

    // Route changes swap whole page subtrees and those pages then fill in
    // asynchronously (profile, credits, lists), so one mutation batch is not
    // enough. Re-pass right after the navigation and once more when the data
    // has had a chance to land.
    const timers: number[] = [];
    const onNavigate = () => {
      timers.push(
        window.setTimeout(retranslateEgyptianDom, 0),
        window.setTimeout(retranslateEgyptianDom, 350),
        window.setTimeout(retranslateEgyptianDom, 1200),
      );
    };
    window.addEventListener("megsy:navigation", onNavigate);
    window.addEventListener("popstate", onNavigate);

    return () => {
      window.removeEventListener("megsy:navigation", onNavigate);
      window.removeEventListener("popstate", onNavigate);
      timers.forEach((id) => window.clearTimeout(id));
      stopEgyptianDom();
    };
  }, [lang]);

  return <>{children}</>;
};

export default TranslationWrapper;
