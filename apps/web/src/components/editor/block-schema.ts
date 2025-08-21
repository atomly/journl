"use client";

import {
	type Block,
	type BlockNoteEditor,
	BlockNoteSchema,
	defaultBlockSpecs,
} from "@blocknote/core";

export const schema = BlockNoteSchema.create({
	blockSpecs: {
		...defaultBlockSpecs,
	},
});

export type EditorPrimitive = BlockNoteEditor<
	typeof schema.blockSchema,
	typeof schema.inlineContentSchema,
	typeof schema.styleSchema
>;

export type BlockPrimitive = Block<
	typeof schema.blockSchema,
	typeof schema.inlineContentSchema,
	typeof schema.styleSchema
>;
