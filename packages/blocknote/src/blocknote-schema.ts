import {
  type Block,
  type BlockNoteEditor,
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  type PartialBlock,
} from "@blocknote/core";
import {
  contentEmbed,
  contentReference,
  referenceCard,
} from "./reference-specs";

export type {
  ReferenceEmbedBlock,
  ReferenceEmbedResult,
  ReferencePreviewData,
  ReferenceRenderAdapter,
  ReferenceRenderTarget,
} from "./reference-context";
export { ReferenceRenderContext } from "./reference-context";

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    referenceCard: referenceCard(),
    contentEmbed: contentEmbed(),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    contentReference,
  },
});

export type EditorPrimitive = BlockNoteEditor<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;

export type EditorPartialBlock = PartialBlock<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;

export type BlockPrimitive = Block<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;
