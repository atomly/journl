"use client";

import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { AlertBlock } from "~/components/ui/custom-blocks/alert-block";
import { TitleBlock } from "~/components/ui/custom-blocks/title-block";

// Minimal schema with NO custom blocks
const schema = BlockNoteSchema.create({
	blockSpecs: {
		...defaultBlockSpecs,
		alert: AlertBlock,
		title: TitleBlock,
	},
});

export default function TestComponent() {
	const editor = useCreateBlockNote({
		initialContent: [
			{
				content: "Test paragraph",
				type: "paragraph",
			},
			// {
			// 	content: "This is an example alert",
			// 	type: "alert",
			// },
			{
				content: "Click the '!' icon to change the alert type",
				type: "paragraph",
			},
			{
				content: "This is a title",
				type: "title",
			},
		],
		schema,
	});

	return (
		<div style={{ minHeight: "400px", padding: "20px" }}>
			<h1>BlockNote Test Page</h1>
			<div style={{ border: "1px solid red", padding: "10px" }}>
				<BlockNoteView editor={editor} />
			</div>
		</div>
	);
}
