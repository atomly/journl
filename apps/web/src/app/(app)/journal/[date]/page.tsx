import { notFound } from "next/navigation";
import { Suspense } from "react";
import { api } from "~/trpc/server";
import {
  JournalEntryAgentView,
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
    <Suspense fallback={<JournalEntryFallback />}>
      <SuspendedJournalEntry date={date} />
    </Suspense>
  );
}

function JournalEntryFallback() {
  return (
    <div className="mx-auto max-w-5xl pt-8 pb-20">
      <JournalEntrySkeleton hasContent />
    </div>
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
        <Suspense fallback={<JournalEntrySkeleton hasContent />}>
          <DynamicJournalEntryEditor>
            <JournalEntryLink>
              <JournalEntryHeader className="px-8" />
            </JournalEntryLink>
          </DynamicJournalEntryEditor>
        </Suspense>
      </JournalEntryWrapper>
      <JournalEntryAgentView />
    </JournalEntryProvider>
  );
}
