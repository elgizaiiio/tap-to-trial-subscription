import { describe, expect, it } from "vitest";
import { fileEditorScript } from "./fileEditor";
describe("file editor", () => {
  it("rejects paths outside /home/user", () => {
    expect(() => fileEditorScript({ command: "view", path: "/etc/passwd" })).toThrow("/home/user/");
    expect(() => fileEditorScript({ command: "view", path: "/home/user/../etc/passwd" })).toThrow("/home/user/");
  });
  it("rejects unknown commands", () => {
    expect(() => fileEditorScript({ command: "delete", path: "/home/user/a.txt" })).toThrow("command must be");
  });
  it("never interpolates file text into the script", () => {
    const script = fileEditorScript({ command: "create", path: "/home/user/a.py", file_text: '"""; import os; os.system("rm -rf /")' });
    expect(script).not.toContain("rm -rf");
  });
});
