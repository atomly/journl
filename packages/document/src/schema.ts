import { z } from "zod/v4";

/** Version of Journl's wire contract, not an editor or database schema version. */
export const DOCUMENT_VERSION = 1 as const;
const object = z.strictObject;
const alignment = z.enum(["left", "center", "right", "justify"]);
const colors = {
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
};
const textProps = { ...colors, textAlignment: alignment.optional() };

export const zReferenceProps = object({
  blockId: z.string(),
  documentId: z.string(),
  label: z.string().max(255),
  resolutionToken: z.string().default(""),
  targetKind: z.enum(["document", "external"]),
  url: z.string().max(2048),
  version: z.literal(1),
});
export type ReferenceProps = z.infer<typeof zReferenceProps>;
export const zTextStyles = object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strike: z.boolean().optional(),
  code: z.boolean().optional(),
  ...colors,
});
export const zText = object({
  type: z.literal("text"),
  text: z.string(),
  styles: zTextStyles.default({}),
});
export const zInline = z.union([
  z.string(),
  zText,
  object({
    type: z.literal("link"),
    href: z.string(),
    content: z.union([z.string(), z.array(zText)]),
  }),
  object({
    type: z.literal("contentReference"),
    props: zReferenceProps,
    content: z.undefined().optional(),
  }),
]);
export const zInlineContent = z.union([z.string(), z.array(zInline)]);
export type InlineContent = z.infer<typeof zInlineContent>;
export const zTableCell = object({
  type: z.literal("tableCell"),
  content: zInlineContent.optional(),
  props: object({
    ...textProps,
    colspan: z.number().int().positive().optional(),
    rowspan: z.number().int().positive().optional(),
  }).optional(),
});
export const zTableContent = object({
  type: z.literal("tableContent"),
  columnWidths: z
    .array(
      z
        .number()
        .nonnegative()
        .nullish()
        .transform((value) => value ?? undefined),
    )
    .optional(),
  headerRows: z.number().int().nonnegative().optional(),
  headerCols: z.number().int().nonnegative().optional(),
  rows: z.array(
    object({ cells: z.union([z.array(zInlineContent), z.array(zTableCell)]) }),
  ),
});
export type TableContent = z.infer<typeof zTableContent>;
const inlineBlock = <T extends string, P extends z.ZodRawShape>(
  type: T,
  props: P,
) =>
  object({
    type: z.literal(type),
    props: object(props).optional(),
    content: zInlineContent.optional(),
  });
const media = {
  backgroundColor: z.string().optional(),
  name: z.string().optional(),
  caption: z.string().optional(),
  url: z.string().optional(),
};
const visualMedia = {
  ...media,
  textAlignment: alignment.optional(),
  showPreview: z.boolean().optional(),
  previewWidth: z.number().optional(),
};
export const zBlockData = z.discriminatedUnion("type", [
  inlineBlock("paragraph", textProps),
  inlineBlock("bulletListItem", textProps),
  inlineBlock("toggleListItem", textProps),
  inlineBlock("quote", colors),
  inlineBlock("numberedListItem", {
    ...textProps,
    start: z.number().optional(),
  }),
  inlineBlock("checkListItem", {
    ...textProps,
    checked: z.boolean().optional(),
  }),
  inlineBlock("heading", {
    ...textProps,
    level: z
      .union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
        z.literal(6),
      ])
      .optional(),
    isToggleable: z.boolean().optional(),
  }),
  // Plain code accepts the historical text-array encoding as well as strings.
  object({
    type: z.literal("codeBlock"),
    props: object({ language: z.string().optional() }).optional(),
    content: z
      .union([
        z.string(),
        z.array(
          z.union([
            z.string(),
            object({
              type: z.literal("text"),
              text: z.string(),
              styles: z.record(z.string(), z.never()).default({}),
            }),
          ]),
        ),
      ])
      .optional(),
  }),
  object({
    type: z.literal("table"),
    props: object({ textColor: z.string().optional() }).optional(),
    content: zTableContent.optional(),
  }),
  object({
    type: z.literal("divider"),
    props: object({}).optional(),
    content: z.undefined().optional(),
  }),
  object({
    type: z.literal("image"),
    props: object(visualMedia).optional(),
    content: z.undefined().optional(),
  }),
  object({
    type: z.literal("video"),
    props: object(visualMedia).optional(),
    content: z.undefined().optional(),
  }),
  object({
    type: z.literal("audio"),
    props: object({ ...media, showPreview: z.boolean().optional() }).optional(),
    content: z.undefined().optional(),
  }),
  object({
    type: z.literal("file"),
    props: object(media).optional(),
    content: z.undefined().optional(),
  }),
  object({
    type: z.literal("referenceCard"),
    props: zReferenceProps,
    content: z.undefined().optional(),
  }),
  object({
    type: z.literal("contentEmbed"),
    props: zReferenceProps,
    content: z.undefined().optional(),
  }),
]);
export type BlockData = z.infer<typeof zBlockData>;
export type DocumentBlock = BlockData & {
  id: string;
  children?: DocumentBlock[];
};
// Validate data separately so strict payload schemas never strip IDs/children.
export function parseBlock(value: unknown): DocumentBlock {
  const envelope = z
    .object({
      id: z.string().min(1),
      children: z.array(z.unknown()).optional(),
    })
    .passthrough()
    .parse(value);
  const { id, children, ...data } = envelope;
  return {
    ...zBlockData.parse(data),
    id,
    ...(children ? { children: children.map(parseBlock) } : {}),
  };
}
export const zDocumentBlock = z.unknown().transform((value, context) => {
  try {
    return parseBlock(value);
  } catch {
    context.addIssue({ code: "custom", message: "Invalid Journl block" });
    return z.NEVER;
  }
});
export const zDocument = object({
  version: z.literal(DOCUMENT_VERSION),
  blocks: z.array(zDocumentBlock),
});
export type JournlDocument = z.infer<typeof zDocument>;
export type DocumentBlocks = [DocumentBlock, ...DocumentBlock[]] | undefined;
