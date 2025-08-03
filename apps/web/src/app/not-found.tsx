"use client";

import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import "./styles/blocknote.css";

export default function NotFound() {
	// Creates a new editor instance.
	const editor = useCreateBlockNote({
		initialContent: [
			{
				content: "Journl #404",
				type: "heading",
			},
			{
				content: "Page not found.",
				type: "paragraph",
			},
			{
				content: "The path was linked, but the note was not.",
				type: "bulletListItem",
			},
			{
				content: "Will investigate later... or probably forget.",
				type: "bulletListItem",
			},
			{
				children: [
					{
						content: "window.location.href = '/';",
						props: { language: "json" },
						type: "codeBlock",
					},
				],
				content: "This should help users find their way back...",
				type: "bulletListItem",
			},
			{
				type: "paragraph",
			},
		],
	});

	return (
		<div className="flex min-h-svh w-full flex-col items-center justify-center gap-y-2 bg-amber-50 p-4">
			<BlockNoteView autoFocus theme="light" editor={editor} />
			<Link href="/">
				<Button>Go back to the home page</Button>
			</Link>
			<div className="flex items-center gap-x-1">
				<span className="text-muted-foreground text-sm">No account?</span>
				<Button className="p-0 text-blue-600" variant="link" asChild>
					<a href="/auth/sign-up">Create one</a>
				</Button>{" "}
			</div>
		</div>
	);
}
