import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormattedAnswer } from "./FormattedAnswer";

/** What the user actually sees when the model answers with a drawing. */
describe("in-chat drawings", () => {
  it("renders a widget fence as a sandboxed picture, never as source", async () => {
    render(
      <FormattedAnswer
        text={'Here is your chart:\n\n```widget\n<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>\n```\n'}
      />,
    );
    const frame = await waitFor(() => {
      const el = document.querySelector("iframe.cx-visual-widget") as HTMLIFrameElement | null;
      expect(el).toBeTruthy();
      return el!;
    });
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.getAttribute("srcdoc")).toContain("<rect");
    expect(screen.queryByText(/<svg/)).toBeNull();
  });

  it("shows an openui fence as plain code because nothing renders that format yet", () => {
    render(<FormattedAnswer text={'```openui\nroot = Col([Title("Hi")], 4)\n```\n'} />);
    expect(screen.getByText(/root = Col/)).toBeInTheDocument();
    expect(document.querySelector("iframe.cx-visual-widget")).toBeNull();
  });

  it("shows a legacy ui JSON fence as plain code because nothing renders that format yet", () => {
    render(<FormattedAnswer text={'```ui\n{"type":"chart","items":[{"label":"a","value":1}]}\n```\n'} />);
    expect(screen.getByText(/"type":"chart"/)).toBeInTheDocument();
    expect(document.querySelector("iframe.cx-visual-widget")).toBeNull();
  });
});

describe("readable answers", () => {
  it("draws inline and display LaTeX, including backslash delimiters", () => {
    const { container } = render(<FormattedAnswer text={"Euler: \\(e^{i\\pi}+1=0\\)\n\n\\[\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}\\]"} />);
    expect(container.querySelectorAll(".katex")).toHaveLength(2);
    expect(container.querySelector(".katex-display")).toBeInTheDocument();
    expect(container.querySelector(".katex-html")?.textContent).not.toContain("\\frac");
  });

  it("leaves LaTeX-looking code unchanged", () => {
    const { container } = render(<FormattedAnswer text={"```tex\n\\(x^2\\)\n```"} />);
    expect(container.querySelector(".katex")).toBeNull();
    expect(screen.getByText("\\(x^2\\)")).toBeInTheDocument();
  });

  it("shows a web source as a titled capsule with the site's favicon", () => {
    render(<FormattedAnswer text={"Read [Ceyo launch notes](https://example.com/news/ceyo)."} />);
    const link = screen.getByRole("link", { name: /Ceyo launch notes/ });
    expect(link).toHaveAttribute("data-source-link");
    expect(link.querySelector("img")).toHaveAttribute("src", "https://icons.duckduckgo.com/ip3/example.com.ico");
  });
});
