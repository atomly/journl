import { createContext } from "react";

export type ReferenceRenderTarget =
  | { kind: "document"; documentId: string; blockId?: string }
  | { kind: "external"; url: string };

export type ReferencePreviewData = {
  status: "ready" | "unavailable";
  kind?: "page" | "journal" | "external";
  href?: string;
  title?: string;
  excerpt?: string;
  truncated?: boolean;
  provider?: "github" | "generic";
  sourceStatus?: string;
  contentUpdatedAt?: string;
};

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

export type ReferenceRenderAdapter = {
  editable?: boolean;
  canConvertInline?(blockId: string): boolean;
  convertBlock(
    blockId: string,
    target: ReferenceRenderTarget,
    display: "contentEmbed" | "link" | "referenceCard",
    label: string,
    href: string,
  ): void;
  convertInline(
    blockId: string,
    target: ReferenceRenderTarget,
    display: "contentEmbed" | "link" | "referenceCard",
    label: string,
    href: string,
    occurrenceIndex?: number,
  ): void;
  loadPreview(target: ReferenceRenderTarget): Promise<ReferencePreviewData>;
  subscribePreview?(
    target: ReferenceRenderTarget,
    listener: (preview: ReferencePreviewData) => void,
  ): () => void;
  loadEmbedContent(
    target: Extract<ReferenceRenderTarget, { kind: "document" }>,
    cursor?: string,
  ): Promise<ReferenceEmbedResult>;
  subscribeEmbedContent?(
    target: Extract<ReferenceRenderTarget, { kind: "document" }>,
    cursor: string | undefined,
    listener: (content: ReferenceEmbedResult | null) => void,
  ): () => void;
  openTarget(target: ReferenceRenderTarget, href?: string): void;
};

export const ReferenceRenderContext =
  createContext<ReferenceRenderAdapter | null>(null);
