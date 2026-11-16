import fr from "./bundled/fr.json";
import de from "./bundled/de.json";
import es from "./bundled/es.json";
import pt from "./bundled/pt.json";
import it from "./bundled/it.json";
import nl from "./bundled/nl.json";
import pl from "./bundled/pl.json";
import tr from "./bundled/tr.json";
import ru from "./bundled/ru.json";
import uk from "./bundled/uk.json";
import hi from "./bundled/hi.json";
import bn from "./bundled/bn.json";
import id from "./bundled/id.json";
import ms from "./bundled/ms.json";
import vi from "./bundled/vi.json";
import th from "./bundled/th.json";
import ja from "./bundled/ja.json";
import ko from "./bundled/ko.json";
import zhCN from "./bundled/zh-CN.json";
import zhTW from "./bundled/zh-TW.json";
import fa from "./bundled/fa.json";
import ur from "./bundled/ur.json";
import sw from "./bundled/sw.json";
import sv from "./bundled/sv.json";

export const BUNDLED_DICTIONARIES: Record<string, Record<string, string>> = {
  fr, de, es, pt, it, nl, pl, tr, ru, uk, hi, bn, id, ms, vi, th, ja, ko,
  "zh-cn": zhCN, "zh-tw": zhTW, fa, ur, sw, sv,
};
export const APP_LANGUAGES = [
  ["en", "English"], ["ar-eg", "العربية"], ["fr", "Français"], ["de", "Deutsch"],
  ["es", "Español"], ["pt", "Português"], ["it", "Italiano"], ["nl", "Nederlands"],
  ["pl", "Polski"], ["tr", "Türkçe"], ["ru", "Русский"], ["uk", "Українська"],
  ["hi", "हिन्दी"], ["bn", "বাংলা"], ["id", "Bahasa Indonesia"], ["ms", "Bahasa Melayu"],
  ["vi", "Tiếng Việt"], ["th", "ไทย"], ["ja", "日本語"], ["ko", "한국어"],
  ["zh-cn", "简体中文"], ["zh-tw", "繁體中文"], ["fa", "فارسی"], ["ur", "اردو"],
  ["sw", "Kiswahili"], ["sv", "Svenska"],
] as const;
export type AppLanguage = typeof APP_LANGUAGES[number][0];
export function normalizeAppLanguage(code: string): AppLanguage | null {
  const value = code.toLowerCase();
  if (value === "ar" || value.startsWith("ar-")) return "ar-eg";
  const exact = APP_LANGUAGES.find(([key]) => key === value);
  if (exact) return exact[0];
  return APP_LANGUAGES.find(([key]) => key === value.split("-")[0])?.[0] ?? null;
}
export function bundledText(text: string, language: string): string {
  return BUNDLED_DICTIONARIES[language]?.[text] || text;
}