import { notFound } from "next/navigation";
import { Suspense } from "react";
import { api } from "~/trpc/server";
import {
	JournalEntryContent,
	JournalEntryHeader,
	JournalEntryProvider,
	JournalEntryTextArea,
} from "../_components/journal-entry";
import { JournalEntrySkeleton } from "../_components/journal-entry-skeleton";

export default async function Page({
	params,
}: {
	params: Promise<{ date: string }>;
}) {
	const { date } = await params;
	return (
		<Suspense fallback={<JournalEntryFallback date={date} />}>
			<SuspendedJournalEntry date={date} />
		</Suspense>
	);
}
async function SuspendedJournalEntry({ date }: { date: string }) {
	const entry = await api.journal.getByDate({ date });

	if (!entry) {
		notFound();
	}

	return (
		<JournalEntryProvider
			className="mx-auto h-full max-w-4xl px-4 py-8 md:px-8"
			entry={entry}
		>
			<JournalEntryHeader forceDate />
			<JournalEntryContent>
				<JournalEntryTextArea autoFocus />
			</JournalEntryContent>
		</JournalEntryProvider>
	);
}

function JournalEntryFallback({ date }: { date: string }) {
	return (
		<JournalEntryProvider
			className="mx-auto min-h-full max-w-4xl px-4 py-8 md:px-8"
			entry={{ date }}
		>
			<JournalEntryHeader className="mb-2" forceDate />
			<JournalEntrySkeleton hasHeader={false} hasContent={true} />
		</JournalEntryProvider>
	);
}
