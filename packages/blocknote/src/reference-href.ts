/** Allow local routes and credential-free web URLs in rendered/exported references. */
export function safeReferenceHref(url: string): string {
  try {
    if (url.startsWith("/")) {
      const parsed = new URL(url, "https://journl.invalid");
      return parsed.origin === "https://journl.invalid"
        ? `${parsed.pathname}${parsed.search}${parsed.hash}`
        : "#";
    }
    const parsed = new URL(url);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      !parsed.username &&
      !parsed.password
      ? parsed.toString()
      : "#";
  } catch {
    return "#";
  }
}
