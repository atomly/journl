/** Only convert an unselected, plain-text URL; preserve native HTML and link-text paste. */
export function getPlainUrlForAutomaticReference(input: {
  html: string;
  selectionEmpty: boolean;
  text: string;
}) {
  if (input.html || !input.selectionEmpty) return null;
  const candidate = input.text.trim();
  if (!candidate || candidate.length > 2048 || /\s/.test(candidate))
    return null;
  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password
    )
      return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
