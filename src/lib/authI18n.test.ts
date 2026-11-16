import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/legacyClient", () => ({ supabase: { auth: { getUser: vi.fn(async () => ({ data: { user: null } })) } } }));
vi.mock("@/lib/payRegion", () => ({ setPayRegion: vi.fn() }));
import { initUserLang, setUserLang, t } from "./authI18n";

describe("saved app language", () => {
  beforeEach(() => localStorage.clear());
  it("keeps the selected language on a subsequent startup", async () => {
    localStorage.setItem("ceyo_language", "fr");
    expect(await initUserLang()).toBe("fr");
    expect(document.documentElement.lang).toBe("fr");
    expect(t("settingsTitle")).toBe("Paramètres");
  });
  it("uses right-to-left layout for Persian", async () => {
    await setUserLang("fa", { syncRemote: false });
    expect(document.documentElement.dir).toBe("rtl");
    expect(localStorage.getItem("app_lang")).toBe("fa");
  });
});