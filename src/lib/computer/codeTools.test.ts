import { describe, it, expect } from "vitest";
import { grepCodeScript, gitScript, zipProjectScript, shq } from "./codeTools";

describe("code tools", () => {
  it("quotes injected patterns as data", () => {
    expect(grepCodeScript({ pattern: "a'; rm -rf / #" })).toContain(shq("a'; rm -rf / #"));
  });
  it("rejects paths outside /home/user", () => {
    expect(() => grepCodeScript({ pattern: "x", path: "/etc" })).toThrow();
    expect(() => gitScript({ action: "status", repo: "/home/user/../etc" })).toThrow();
  });
  it("only clones public https URLs", () => {
    expect(() => gitScript({ action: "clone", url: "file:///etc" })).toThrow();
    expect(gitScript({ action: "clone", url: "https://github.com/a/b" })).toContain("git clone");
  });
  it("rejects unknown git actions like push", () => {
    expect(() => gitScript({ action: "push" })).toThrow();
  });
  it("zip excludes dependencies and secrets", () => {
    const { script, out } = zipProjectScript({ path: "/home/user/app", name: "my site" });
    expect(out).toBe("/home/user/my_site.zip");
    expect(script).toContain("node_modules/*");
    expect(script).toContain(".env");
  });
});
