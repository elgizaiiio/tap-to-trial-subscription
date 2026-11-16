import { describe, expect, it } from "vitest";
import { APP_LANGUAGES, BUNDLED_DICTIONARIES, normalizeAppLanguage } from "./bundledLocales";

describe("bundled language coverage", () => {
  it("ships more than twenty usable dictionaries", () => {
    expect(APP_LANGUAGES).toHaveLength(26);
    expect(Object.keys(BUNDLED_DICTIONARIES)).toHaveLength(24);
    for (const dictionary of Object.values(BUNDLED_DICTIONARIES)) {
      expect(Object.keys(dictionary).length).toBeGreaterThan(2700);
      expect(dictionary.Settings).toBeTruthy();
    }
  });
  it("maps phone locales and Arabic settings to supported languages", () => {
    expect(normalizeAppLanguage("ar")).toBe("ar-eg");
    expect(normalizeAppLanguage("zh-CN")).toBe("zh-cn");
    expect(normalizeAppLanguage("fr-CA")).toBe("fr");
    expect(normalizeAppLanguage("unknown")).toBeNull();
  });
});