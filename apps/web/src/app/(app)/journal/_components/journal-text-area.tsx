"use client";

import { useState } from "react";

export function JournalTextArea() {
	const [content, setContent] = useState("");

	return (
		<textarea
			value={content}
			onChange={(e) => setContent(e.target.value)}
			placeholder="Start writing your journal entry..."
			className="h-full w-full resize-none border-none bg-transparent text-base leading-relaxed outline-none placeholder:text-muted-foreground"
			style={{ minHeight: "calc(100vh - 200px)" }}
		/>
	);
}
