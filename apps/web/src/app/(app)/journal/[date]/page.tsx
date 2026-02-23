import { notFound } from "next/navigation";
import { Suspense } from "react";
import { api } from "~/trpc/server";
import {
  JournalEntryAgentView,
  JournalEntryContent,
  JournalEntryHeader,
  JournalEntryLink,
  JournalEntryProvider,
  JournalEntryWrapper,
} from "../_components/journal-entry-editor";
import { DynamicJournalEntryEditor } from "../_components/journal-entry-editor.dynamic";
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

function JournalEntryFallback({ date }: { date: string }) {
  return (
    <JournalEntryProvider
      className="mx-auto min-h-full max-w-5xl px-4 py-8"
      entry={{ date }}
    >
      <JournalEntryHeader className="mb-6" />
      <JournalEntrySkeleton hasHeader={false} hasContent />
    </JournalEntryProvider>
  );
}

async function SuspendedJournalEntry({ date }: { date: string }) {
  const entry = await api.journal.getByDate({ date });

  if (!entry) {
    notFound();
  }

  return (
    <JournalEntryProvider entry={entry}>
      <JournalEntryWrapper className="mx-auto max-w-5xl pt-8 pb-20">
        <JournalEntryLink>
          <JournalEntryHeader className="px-4" />
        </JournalEntryLink>
        <JournalEntryContent>
          <Suspense fallback={<JournalEntrySkeleton hasContent />}>
            <DynamicJournalEntryEditor />
          </Suspense>
        </JournalEntryContent>
      </JournalEntryWrapper>
      <JournalEntryAgentView />
    </JournalEntryProvider>
  );
}
