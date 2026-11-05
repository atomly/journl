/** Presentation contracts are transient; they are never document storage. */
export type ReferencePreviewData = {
  status: "ready" | "unavailable";
  unavailableReason?: "target-unavailable";
  kind?: "page" | "journal" | "external";
  href?: string;
  title?: string;
  excerpt?: string;
  imageUrl?: string;
  metadataState?: "enriched" | "url-only";
  enrichment?: "ready" | "missing" | "failed" | "busy";
  truncated?: boolean;
  provider?: string;
  sourceLabel?: string;
  icon?: string;
  compactLabel?: string;
  sourceStatus?: string;
  contentUpdatedAt?: string;
};
export type ExternalDescription = {
  provider: string;
  title: string;
  excerpt: string;
  sourceLabel: string;
  icon: string;
  compactLabel?: string;
  graphTitle: string;
};
export type PreviewSource = {
  id: string;
  describe(url: URL): ExternalDescription | null;
};
export const githubSource: PreviewSource = {
  describe(url) {
    if (url.hostname.toLowerCase() !== "github.com" || url.port || url.search)
      return null;
    const match = /^\/([\w.-]+)\/([\w.-]+)(?:\/(issues|pull)\/(\d+))?\/?$/.exec(
      url.pathname,
    );
    if (!match) return null;
    const repo = `${match[1]}/${match[2]}`;
    const section = match[3];
    const title = section ? `${repo} #${match[4]}` : repo;
    return {
      compactLabel: title,
      excerpt: `GitHub · ${title}`,
      graphTitle: section
        ? `${repo} · ${section === "pull" ? "PR" : "Issue"} #${match[4]}`
        : repo,
      icon:
        section === "pull"
          ? "pull-request"
          : section === "issues"
            ? "issue"
            : "repository",
      provider: "github",
      sourceLabel: "GitHub",
      title,
    };
  },
  id: "github",
};
export const websiteSource: PreviewSource = {
  describe(url) {
    const title = `${url.hostname}${url.pathname === "/" ? "" : url.pathname}${url.search}${url.hash}`;
    return {
      excerpt: url.href,
      graphTitle: title,
      icon: "external",
      provider: "website",
      sourceLabel: url.hostname,
      title,
    };
  },
  id: "website",
};
/** Ordered descriptions are also usable without network access (Explore/fallbacks). */
export const previewSources = [githubSource, websiteSource];
export function describeExternal(
  value: string,
  sources: readonly PreviewSource[] = previewSources,
) {
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    for (const source of sources) {
      const description = source.describe(url);
      if (description) return description;
    }
  } catch {
    /* An invalid target has no presentation. */
  }
  return null;
}

export type InternalReferenceTarget = {
  kind: "document";
  documentId: string;
  blockId?: string;
};
export type ExternalReferenceTarget = { kind: "external"; url: string };
export type ReferenceTarget = InternalReferenceTarget | ExternalReferenceTarget;
export type ReferenceEmbedBlock = {
  id?: string;
  type: string;
  props?: Record<string, string | number | boolean>;
  content?: unknown;
  depth?: number;
};
export type ReferenceEmbedResult = {
  status: "ready" | "unavailable";
  title?: string;
  href?: string;
  blocks?: ReferenceEmbedBlock[];
  truncated?: boolean;
  nextCursor?: string | null;
  contentUpdatedAt?: string;
};
export type ReferenceClient = {
  resolveUrl(url: string): Promise<{
    items: {
      target: ReferenceTarget | null;
      preview: ReferencePreviewData;
      url?: string;
    }[];
  }>;
  loadPreview(target: ReferenceTarget): Promise<ReferencePreviewData>;
  subscribePreview?(
    target: ReferenceTarget,
    listener: (preview: ReferencePreviewData) => void,
  ): () => void;
  loadEmbedContent(
    target: Extract<ReferenceTarget, { kind: "document" }>,
    cursor?: string,
  ): Promise<ReferenceEmbedResult>;
  subscribeEmbedContent?(
    target: Extract<ReferenceTarget, { kind: "document" }>,
    cursor: string | undefined,
    listener: (content: ReferenceEmbedResult | null) => void,
  ): () => void;
  openTarget(target: ReferenceTarget, href?: string): void;
};

export { getPlainUrlForAutomaticReference } from "./paste";
