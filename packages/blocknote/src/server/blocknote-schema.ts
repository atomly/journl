import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
} from "@blocknote/core";
import type {
  BlockPrimitive,
  EditorPartialBlock,
  EditorPrimitive,
  schema as clientSchema,
} from "../blocknote-schema";
import {
  contentEmbed,
  contentReference,
  referenceCard,
} from "./reference-specs";

export const serverSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    referenceCard,
    contentEmbed,
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    contentReference,
  },
}) as typeof clientSchema;

export type { BlockPrimitive, EditorPartialBlock, EditorPrimitive };
