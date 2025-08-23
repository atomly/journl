"use client";

import type { BlockTransaction } from "@acme/api";
import type { Page } from "@acme/db/schema";
import type { PartialBlock } from "@blocknote/core";
import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { BlockEditor } from "~/components/editor/block-editor";
import { useTRPC } from "~/trpc/react";

type PageEditorProps = {
  page: Pick<Page, "id" | "title" | "document_id">;
  initialBlocks: [PartialBlock, ...PartialBlock[]] | undefined;
  debounceTime?: number;
};

export function PageEditor({
  page,
  initialBlocks,
  debounceTime = 200,
}: PageEditorProps) {
  const trpc = useTRPC();
  const pendingChangesRef = useRef<BlockTransaction[]>([]);

  const { mutate, isPending } = useMutation({
    ...trpc.blocks.saveTransactions.mutationOptions({}),
    // ! TODO: When the mutation fails we need to revert the changes to the editor just like Notion does.
    // ! To do this we can use `onError` and `editor.undo()`, without calling the transactions. We might have to get creative.
    // ! Maybe we can refetch the blocks after an error instead of `undo`?
    onSuccess: () => {
      if (pendingChangesRef.current.length > 0) {
        debouncedMutate();
      }
    },
  });

  const debouncedMutate = useDebouncedCallback(() => {
    if (isPending) return;
    const transactions = pendingChangesRef.current;
    pendingChangesRef.current = [];
    mutate({ document_id: page.document_id, transactions });
  }, debounceTime);

  function handleEditorChange(transactions: BlockTransaction[]) {
    pendingChangesRef.current.push(...transactions);

    debouncedMutate();
  }

  return (
    <BlockEditor initialBlocks={initialBlocks} onChange={handleEditorChange} />
  );
}
