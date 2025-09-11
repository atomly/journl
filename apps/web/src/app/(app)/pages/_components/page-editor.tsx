"use client";

import type { BlockTransaction } from "@acme/api";
import type { Page } from "@acme/db/schema";
import type { PartialBlock } from "@blocknote/core";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useJournlAgentAwareness } from "~/ai/agents/use-journl-agent-awareness";
import { BlockEditor } from "~/components/editor/block-editor";
import {
  BlockEditorFormattingToolbar,
  BlockEditorSlashMenu,
} from "~/components/editor/block-editor-tools";
import { useBlockEditor } from "~/components/editor/use-block-editor";
import { useTRPC } from "~/trpc/react";

const DEFAULT_DEBOUNCE_TIME = 150;

type PageEditorProps = {
  page: Pick<Page, "id" | "title" | "document_id">;
  initialBlocks: [PartialBlock, ...PartialBlock[]] | undefined;
  debounceTime?: number;
};

export function PageEditor({
  page,
  initialBlocks,
  debounceTime = DEFAULT_DEBOUNCE_TIME,
}: PageEditorProps) {
  const trpc = useTRPC();
  const pendingChangesRef = useRef<BlockTransaction[]>([]);
  const {
    rememberEditor: setEditor,
    forgetEditor: removeEditor,
    rememberView: setView,
  } = useJournlAgentAwareness();
  const editor = useBlockEditor({ initialBlocks });

  const { mutate, isPending } = useMutation({
    ...trpc.pages.saveTransactions.mutationOptions({}),
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

  useEffect(() => {
    setView({
      id: page.id,
      name: "page",
      title: page.title,
    });
    return () => {
      setView({
        name: "other",
      });
    };
  }, [page.id, page.title, setView]);

  useEffect(() => {
    setEditor(page.id, editor);
    return () => {
      removeEditor(page.id);
    };
  }, [page.id, editor, setEditor, removeEditor]);

  return (
    <BlockEditor
      editor={editor}
      initialBlocks={initialBlocks}
      onChange={handleEditorChange}
      // Disabling the default because we're using a formatting toolbar with the AI option.
      formattingToolbar={false}
      // Disabling the default because we're using a slash menu with the AI option.
      slashMenu={false}
    >
      <BlockEditorFormattingToolbar />
      <BlockEditorSlashMenu />
    </BlockEditor>
  );
}
