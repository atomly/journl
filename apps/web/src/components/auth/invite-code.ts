export function parseInviteCodeString(
  searchParam: string | string[] | undefined,
) {
  if (typeof searchParam === "string") {
    return searchParam;
  }
  return searchParam?.[0];
}
