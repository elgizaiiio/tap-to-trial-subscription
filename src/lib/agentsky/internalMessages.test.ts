import { expect, it } from "vitest";
import { isInternalMessage } from "./internalMessages";

it("hides saved internal messages after history reload", () => {
  const rows = [{ metadata: { internal: true }, text: "Continue" }, { metadata: {}, text: "My task" }];
  expect(rows.filter((r) => !isInternalMessage(r.metadata)).map((r) => r.text)).toEqual(["My task"]);
});
it("does not hide messages without an explicit internal marker", () => {
  for (const metadata of [undefined, null, {}, { internal: "true" }, { internal: false }]) expect(isInternalMessage(metadata)).toBe(false);
});