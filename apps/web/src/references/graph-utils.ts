import type { ReferenceTarget } from "@acme/references";
import { describeExternal } from "@acme/references";

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
  return describeExternal(url)?.graphTitle ?? url;
}
