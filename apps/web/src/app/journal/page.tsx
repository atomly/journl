"use client";

import { JournalTextArea } from "./_components/text-area/journal-text-area";

export default function JournalPage() {
	return (
		<main className="flex flex-1 flex-col">
			<div className="mx-auto w-full max-w-4xl flex-1 p-6">
				<JournalTextArea />
			</div>
		</main>
	);
}
