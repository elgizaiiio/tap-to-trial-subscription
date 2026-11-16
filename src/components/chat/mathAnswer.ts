/** Accept the two LaTeX delimiter styles models commonly emit while leaving code untouched. */
export function normalizeMathDelimiters(markdown: string): string {
  const code: string[] = [];
  const protectedText = markdown.replace(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`+[^`\n]*`+)/g, (match) => {
    code.push(match);
    return `\uE000${code.length - 1}\uE001`;
  });

  const normalized = protectedText
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, math: string) => `\n\n$$\n${math.trim()}\n$$\n\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, math: string) => `$${math.trim()}$`);

  return normalized.replace(/\uE000(\d+)\uE001/g, (_match, index: string) => code[Number(index)] ?? "");
}
