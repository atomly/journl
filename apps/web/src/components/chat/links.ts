/** Model-provided citations are data, not permission to execute a URL. */
export function safeChatLink(value: string): string | undefined {
  const url = value.trim();
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\"))
    return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ||
      parsed.protocol === "http:" ||
      parsed.protocol === "mailto:"
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}
