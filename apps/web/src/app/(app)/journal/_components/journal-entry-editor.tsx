"use client";

import type { BlockTransaction, TimelineEntry } from "@acme/api";
import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { BlockEditor } from "~/components/editor/block-editor";
import { useTRPC } from "~/trpc/react";
import { useJournalEntry } from "./journal-entry-provider";

const DEFAULT_DEBOUNCE_TIME = 150;

type PageEditorProps = {
  debounceTime?: number;
  onCreate?: (newEntry: TimelineEntry) => void;
};

export function JournalEntryEditor({
  debounceTime = DEFAULT_DEBOUNCE_TIME,
  onCreate,
}: PageEditorProps) {
  const trpc = useTRPC();
  const pendingChangesRef = useRef<BlockTransaction[]>([]);
  const { initialBlocks, documentId, date } = useJournalEntry();

  const { mutate, isPending } = useMutation({
    ...trpc.journal.saveTransactions.mutationOptions({}),
    // ! TODO: When the mutation fails we need to revert the changes to the editor just like Notion does.
    // ! To do this we can use `onError` and `editor.undo()`, without calling the transactions. We might have to get creative.
    // ! Maybe we can refetch the blocks after an error instead of `undo`?
    onSuccess: (data) => {
      if (pendingChangesRef.current.length > 0) {
        debouncedMutate();
      }
      if (!documentId && data) {
        onCreate?.(data);
      }
    },
  });

  const debouncedMutate = useDebouncedCallback(() => {
    if (isPending) return;
    const transactions = pendingChangesRef.current;
    pendingChangesRef.current = [];
    mutate({ date, document_id: documentId, transactions });
  }, debounceTime);

  function handleEditorChange(transactions: BlockTransaction[]) {
    pendingChangesRef.current.push(...transactions);

    debouncedMutate();
  }

  return (
    <BlockEditor initialBlocks={initialBlocks} onChange={handleEditorChange} />
  );
}
