/** Browser-safe URL validation; never store a hosting credential here. */
export function independentAppOrigin(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || /(^|\.)lovable\.(app|dev)$/i.test(url.hostname)) {
    throw new Error("Configure an independent HTTPS app address");
  }
  return url.origin;
}