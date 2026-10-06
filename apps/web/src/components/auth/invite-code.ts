export const INVITE_CODE_PATTERN = /^[A-Z0-9]{8,128}$/;

export function normalizeInviteCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");
  return INVITE_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function parseInviteCodeString(
  searchParam: string | string[] | undefined,
) {
  if (typeof searchParam === "string") {
    return searchParam;
  }
  return searchParam?.[0];
}
