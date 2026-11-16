import { translateExactText, type AuthLang } from "@/lib/authI18n";

// Translate interface controls only; user messages, code and editable text remain untouched.
const CONTROL = "button, [role=button], label, [role=tab], nav, h1, h2, h3, [data-interface-text]";
const PRIVATE = "[data-no-translate], [contenteditable], textarea, pre, code, iframe, .chat-message, .message-content, .markdown-body";
export function startInterfaceTranslation(language: AuthLang): () => void {
  const originals = new Map<Text, { original: string; rendered: string }>();
  const attributes = new Map<Element, Map<string, { original: string; rendered: string }>>();
  let observer: MutationObserver;
  const scan = () => {
    observer?.disconnect();
    for (const control of document.body.querySelectorAll(CONTROL)) {
      if (control.closest(PRIVATE)) continue;
      const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const text = node as Text;
        if (!text.parentElement?.closest(PRIVATE)) {
          const current = text.nodeValue || "";
          const previous = originals.get(text);
          const source = previous?.rendered === current ? previous.original : current;
          const translated = translateExactText(source.trim(), language);
          if (translated !== source.trim()) {
            const rendered = `${source.match(/^\s*/)?.[0] || ""}${translated}${source.match(/\s*$/)?.[0] || ""}`;
            originals.set(text, { original: source, rendered });
            text.nodeValue = rendered;
          }
        }
        node = walker.nextNode();
      }
    }
    document.body.querySelectorAll("[placeholder], [aria-label], [title]").forEach(element => {
      if (element.closest(PRIVATE)) return;
      for (const attribute of ["placeholder", "aria-label", "title"]) {
        const current = element.getAttribute(attribute);
        if (!current) continue;
        const values = attributes.get(element) || new Map();
        const previous = values.get(attribute);
        const original = previous?.rendered === current ? previous.original : current;
        const rendered = translateExactText(original, language);
        if (rendered !== original) {
          values.set(attribute, { original, rendered }); attributes.set(element, values);
          element.setAttribute(attribute, rendered);
        }
      }
    });
    for (const node of originals.keys()) if (!node.isConnected) originals.delete(node);
    for (const element of attributes.keys()) if (!element.isConnected) attributes.delete(element);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  observer = new MutationObserver(() => {
    if (timer !== undefined) return;
    timer = setTimeout(() => { timer = undefined; scan(); }, 30);
  });
  scan();
  return () => {
    observer.disconnect(); clearTimeout(timer);
    for (const [node, value] of originals) if (node.nodeValue === value.rendered) node.nodeValue = value.original;
    for (const [element, values] of attributes) for (const [attribute, value] of values) {
      if (element.getAttribute(attribute) === value.rendered) element.setAttribute(attribute, value.original);
    }
    originals.clear(); attributes.clear();
  };
}