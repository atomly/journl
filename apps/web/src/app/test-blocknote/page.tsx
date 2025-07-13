"use client";

import { BlockNoteEditor } from "~/components/editor/blocknote-editor";

export default function TestBlockNotePage() {
	const mockBlocks = [
		{
			content: [],
			created_at: new Date(),
			created_by: "test-user",
			id: "1",
			parent_id: "test-page",
			parent_type: "page",
			properties: { content: "This is a test paragraph block" },
			type: "paragraph",
			updated_at: new Date(),
		},
		{
			content: [],
			created_at: new Date(),
			created_by: "test-user",
			id: "2",
			parent_id: "test-page",
			parent_type: "page",
			properties: { content: "This is a heading" },
			type: "heading_1",
			updated_at: new Date(),
		},
		{
			content: [],
			created_at: new Date(),
			created_by: "test-user",
			id: "3",
			parent_id: "test-page",
			parent_type: "page",
			properties: { checked: false, content: "This is a todo item" },
			type: "todo",
			updated_at: new Date(),
		},
	];

	return (
		<div className="container mx-auto p-8">
			<h1 className="mb-6 font-bold text-2xl">BlockNote Integration Test</h1>
			<div className="rounded-lg border p-4">
				<BlockNoteEditor
					blocks={mockBlocks}
					parentId="test-page"
					parentType="page"
				/>
			</div>
		</div>
	);
}
