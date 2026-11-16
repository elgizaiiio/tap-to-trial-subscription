import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PinnedMessages, pinnedMessagePreview } from "./PinnedMessages";

describe("pinned chat messages", () => {
  it("jumps straight to a single pinned message", () => {
    const onOpen = vi.fn();
    render(<PinnedMessages messages={[{ key: "message-1", text: "Important plan" }]} ar={false} onOpen={onOpen} onUnpin={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pinned messages" }));
    expect(onOpen).toHaveBeenCalledWith("message-1");
  });

  it("opens a compact list and unpins the chosen message", () => {
    const onUnpin = vi.fn();
    render(<PinnedMessages messages={[{ key: "message-1", text: "First" }, { key: "message-2", text: "Second" }]} ar={false} onOpen={vi.fn()} onUnpin={onUnpin} />);
    fireEvent.click(screen.getByRole("button", { name: "Pinned messages" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Unpin message" })[0]);
    expect(onUnpin).toHaveBeenCalledWith("message-2");
  });

  it("keeps previews readable instead of showing markdown clutter", () => {
    expect(pinnedMessagePreview("**Launch** [site](https://example.com)\n\n```js\nconst x = 1\n```")).toBe("Launch site Code");
    expect(pinnedMessagePreview("Quadratic \\(x^2\\)")).toBe("Quadratic Equation");
    expect(pinnedMessagePreview("القانون \\(x^2\\)", true)).toBe("القانون معادلة");
  });
});
