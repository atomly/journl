"use client";

import type { EditorPartialBlock } from "@acme/blocknote/schema";
import type { Page } from "@acme/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { BlockEditor } from "~/components/editor/block-editor";
import { BlockEditorErrorOverlay } from "~/components/editor/block-editor-error-overlay";
import { useBlockEditor } from "~/components/editor/use-block-editor";
import { ReferenceBacklinks } from "~/components/references/reference-backlinks";
import { PageCreatedEvent } from "~/events/page-created-event";
import { useAppEventHandler } from "~/hooks/use-app-event-handler";
import { useJournlAgent } from "~/hooks/use-journl-agent";
import type { BlockTransaction } from "~/trpc";
import { useTRPC } from "~/trpc/react";

const DEFAULT_DEBOUNCE_TIME = 1000;

type PageEditorProps = Omit<
  React.ComponentProps<typeof BlockEditor>,
  "editor" | "onChange" | "formattingToolbar" | "slashMenu"
> & {
  page: Pick<Page, "id" | "title" | "document_id">;
  initialBlocks: [EditorPartialBlock, ...EditorPartialBlock[]] | undefined;
  debounceTime?: number;
};

export function PageEditor({
  page,
  initialBlocks,
  debounceTime = DEFAULT_DEBOUNCE_TIME,
  ...rest
}: PageEditorProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const pendingChangesRef = useRef<BlockTransaction[]>([]);
  const { setEditor, unsetEditor, setView } = useJournlAgent();
  const editor = useBlockEditor({ initialBlocks });
  const [isOverlayOpen, setOverlayOpen] = useState(false);

  /**
   * Handles the error state of the editor.
   *
   * @privateRemarks
   *
   * Using replace() to avoid creating a new history entry
   */
  function handleError() {
    setOverlayOpen(true);
    requestAnimationFrame(() => {
      location.replace(location.href);
    });
  }

  const { mutate, isPending } = useMutation({
    ...trpc.pages.saveTransactions.mutationOptions({}),
    onError: (error) => {
      console.error("[PageEditor] error 👀", error);
      handleError();
    },
    onSuccess: () => {
      for (const queryKey of [
        trpc.references.getPreviews.queryKey(),
        trpc.references.getEmbedContent.queryKey(),
        trpc.references.listBacklinks.queryKey(),
        trpc.references.listOccurrences.queryKey(),
        trpc.references.queryNeighbors.queryKey(),
        trpc.references.getGraph.infiniteQueryKey(),
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
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
    const id = `page:${page.id}` as const;
    setEditor({ editor, id });
    return () => {
      unsetEditor(id);
    };
  }, [page.id, editor, setEditor, unsetEditor]);

  useAppEventHandler(
    ({ payload }) => {
      if (payload.tool) {
        void payload.tool.chat.addToolOutput({
          output: `Opened new page: ${payload.title}`,
          tool: payload.tool.toolName,
          toolCallId: payload.tool.toolCallId,
        });
      }
      if (payload.title) {
        editor.focus();
      }
    },
    [PageCreatedEvent, page.id],
  );

  return (
    <>
      <BlockEditor
        editor={editor}
        onChange={handleEditorChange}
        // Disabling the default because we're using a formatting toolbar with the AI option.
        formattingToolbar={false}
        // Disabling the default because we're using a slash menu with the AI option.
        slashMenu={false}
        {...rest}
      />
      <ReferenceBacklinks documentId={page.document_id} />
      <BlockEditorErrorOverlay isOpen={isOverlayOpen} />
    </>
  );
}
