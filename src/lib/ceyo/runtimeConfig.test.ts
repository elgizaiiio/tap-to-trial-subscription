import { describe, expect, it } from "vitest";
import { independentAppOrigin } from "./runtimeConfig";
describe("independent hosting", () => {
  it("retains the owner's independent origin", () => {
    expect(independentAppOrigin("https://web.ceyo.si/a")).toBe("https://web.ceyo.si");
  });
  it("rejects Lovable hosts before generating an external callback", () => {
    expect(() => independentAppOrigin("https://hush-flow-sanctuary.lovable.app")).toThrow();
    expect(() => independentAppOrigin("http://web.ceyo.si")).toThrow();
    expect(() => independentAppOrigin("https://user:pass@web.ceyo.si")).toThrow();
  });
});