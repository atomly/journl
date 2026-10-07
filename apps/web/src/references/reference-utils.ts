import { createHash } from "node:crypto";
import { z } from "zod/v4";

export const zReferenceProps = z.object({
  blockId: z.string(),
  documentId: z.string(),
  label: z.string().max(255),
  targetKind: z.enum(["document", "external"]),
  url: z.string().max(2048),
  version: z.literal(1),
});

export type InternalReferenceTarget = {
  kind: "document";
  documentId: string;
  blockId?: string;
};
export type ExternalReferenceTarget = { kind: "external"; url: string };
export type ReferenceTarget = InternalReferenceTarget | ExternalReferenceTarget;

export type CanonicalRoute =
  | { kind: "page"; entityId: string; blockId?: string }
  | { kind: "journal"; date: string; blockId?: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function containsControlCharacter(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function isRealDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function classifyInternalUrl(
  value: string,
  trustedOrigins: string[],
  baseUrl: string,
): CanonicalRoute | null {
  if (value.length > 2048 || containsControlCharacter(value)) return null;
  let parsed: URL;
  try {
    parsed = new URL(value, baseUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  const base = new URL(baseUrl);
  if (
    parsed.origin !== base.origin &&
    !trustedOrigins.includes(parsed.origin)
  ) {
    return null;
  }

  const page = parsed.pathname.match(/^\/pages\/([^/]+)\/?$/);
  const blockFragment = parsed.hash.match(/^#block=([0-9a-f-]{36})$/i);
  if (parsed.hash && (!blockFragment || !UUID.test(blockFragment[1] ?? ""))) {
    return null;
  }
  const blockId = blockFragment?.[1];
  if (page?.[1] && UUID.test(page[1])) {
    return { entityId: page[1], kind: "page", ...(blockId ? { blockId } : {}) };
  }
  const journal = parsed.pathname.match(/^\/journal\/(\d{4}-\d{2}-\d{2})\/?$/);
  if (journal?.[1] && isRealDate(journal[1])) {
    return {
      date: journal[1],
      kind: "journal",
      ...(blockId ? { blockId } : {}),
    };
  }
  return null;
}

export function normalizeExternalUrl(value: string) {
  const parsed = new URL(value);
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username ||
    parsed.password ||
    containsControlCharacter(value)
  ) {
    return null;
  }
  parsed.hash = "";
  return parsed.toString();
}

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

export function getTargetKey(target: ReferenceTarget) {
  if (target.kind === "document") {
    return target.blockId
      ? `document:${target.documentId}#block:${target.blockId}`
      : `document:${target.documentId}`;
  }
  const normalized = normalizeExternalUrl(target.url);
  if (!normalized) return null;
  const digest = createHash("sha256").update(normalized).digest("hex");
  return `external:${digest}`;
}

type RefOccurrence = {
  identity: "explicit" | "route";
  occurrencePath: string;
  presentation: "link" | "badge" | "card" | "embed";
  target: ReferenceTarget | null;
  route?: CanonicalRoute;
};

type UnknownRecord = Record<string, unknown>;

export function extractReferenceOccurrences(
  data: unknown,
  options: { trustedOrigins?: string[]; baseUrl: string },
): RefOccurrence[] {
  const occurrences: RefOccurrence[] = [];
  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        visit(item, `${path}/${index}`);
      });
      return;
    }
    if (value === null || typeof value !== "object") return;
    const record = value as UnknownRecord;
    const type = record.type;

    if (
      type === "contentReference" ||
      type === "referenceCard" ||
      type === "contentEmbed"
    ) {
      const parsed = zReferenceProps.safeParse(record.props);
      if (parsed.success) {
        const props = parsed.data;
        let target: ReferenceTarget | null = null;
        if (
          props.targetKind === "document" &&
          UUID.test(props.documentId) &&
          (!props.blockId || UUID.test(props.blockId))
        ) {
          target = {
            documentId: props.documentId,
            kind: "document",
            ...(props.blockId ? { blockId: props.blockId } : {}),
          };
        } else if (
          props.targetKind === "external" &&
          !props.documentId &&
          !props.blockId
        ) {
          const url = normalizeExternalUrl(props.url);
          if (url) target = { kind: "external", url };
        }
        if (target && (type !== "contentEmbed" || target.kind === "document")) {
          occurrences.push({
            identity: "explicit",
            occurrencePath:
              type.endsWith("Card") || type === "contentEmbed"
                ? `${path}/props`
                : path,
            presentation:
              type === "contentReference"
                ? "badge"
                : type === "referenceCard"
                  ? "card"
                  : "embed",
            target,
          });
        }
      }
    } else if (type === "link") {
      const href = typeof record.href === "string" ? record.href : null;
      if (href) {
        const route = classifyInternalUrl(
          href,
          options.trustedOrigins ?? [],
          options.baseUrl,
        );
        if (route) {
          occurrences.push({
            identity: "route",
            occurrencePath: path,
            presentation: "link",
            route,
            target: null,
          });
        } else {
          let absoluteHref: string | null = null;
          try {
            absoluteHref = new URL(href, options.baseUrl).toString();
          } catch {
            absoluteHref = null;
          }
          if (absoluteHref) {
            const parsedHref = new URL(absoluteHref);
            const baseOrigin = new URL(options.baseUrl).origin;
            const looksLikeInternalRoute =
              (parsedHref.origin === baseOrigin ||
                (options.trustedOrigins ?? []).includes(parsedHref.origin)) &&
              /^\/(pages|journal)\//.test(parsedHref.pathname);
            if (looksLikeInternalRoute) return;
          }
          const parsed = absoluteHref
            ? normalizeExternalUrl(absoluteHref)
            : null;
          if (parsed) {
            occurrences.push({
              identity: "explicit",
              occurrencePath: path,
              presentation: "link",
              target: { kind: "external", url: parsed },
            });
          }
        }
      }
    }

    // Follow authored content containers only. Props and unrelated metadata
    // are intentionally excluded, as are code block strings and attributes.
    if (record.type === "codeBlock") return;
    for (const key of ["content", "rows", "cells"]) {
      if (key in record) visit(record[key], `${path}/${key}`);
    }
  };

  visit(data, "");
  return occurrences;
}
