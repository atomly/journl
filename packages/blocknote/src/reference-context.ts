import type { ReferenceClient, ReferenceTarget } from "@acme/references";
import { createContext } from "react";

export type ReferenceRenderAdapter = Omit<ReferenceClient, "resolveUrl"> & {
  editable?: boolean;
  canConvertInline?(blockId: string): boolean;
  convertBlock(
    blockId: string,
    target: ReferenceTarget,
    display: "contentEmbed" | "contentReference" | "link" | "referenceCard",
    label: string,
    href: string,
  ): void;
  convertInline(
    blockId: string,
    target: ReferenceTarget,
    display: "contentEmbed" | "contentReference" | "link" | "referenceCard",
    label: string,
    href: string,
    occurrenceIndex?: number,
  ): void;
};

export const ReferenceRenderContext =
  createContext<ReferenceRenderAdapter | null>(null);
