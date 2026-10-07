import type { ReferenceTarget } from "./reference-utils";

export function getGraphDocumentTargetKey(
  target: Extract<ReferenceTarget, { kind: "document" }>,
  includeBlocks: boolean,
) {
  const key = `document:${target.documentId}`;
  return includeBlocks && target.blockId
    ? `${key}#block:${target.blockId}`
    : key;
}

export function getExternalGraphTitle(url: string) {
  const parsed = new URL(url);
  const github =
    parsed.hostname.toLowerCase() === "github.com"
      ? /^\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)\/?$/.exec(parsed.pathname)
      : null;
  if (github)
    return `${github[1]}/${github[2]} · ${github[3] === "pull" ? "PR" : "Issue"} #${github[4]}`;
  // Each node represents a URL, not a domain or repository. Keep paths and
  // query parameters visible so separate destinations don't look identical.
  return `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}${parsed.search}`;
}
