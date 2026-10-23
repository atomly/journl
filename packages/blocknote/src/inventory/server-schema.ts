// Test-only headless fixture for the installed legacy editor, not a backend content model.
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
} from "@blocknote/core";
import type { schema } from "../blocknote-schema";
import {
  contentEmbed,
  contentReference,
  referenceCard,
} from "./reference-specs";

export const inventorySchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    referenceCard,
    contentEmbed,
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    contentReference,
  },
}) as typeof schema;
