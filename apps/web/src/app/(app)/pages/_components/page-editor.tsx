"use client";

import { fromBlockNoteBlocks } from "@acme/blocknote/adapter";
import type { Page } from "@acme/db/schema";
import type { DocumentBlock } from "@acme/document";
import { useEffect, useSyncExternalStore } from "react";
import { BlockEditor } from "~/components/editor/block-editor";
import { acceptedDocumentChange } from "~/components/editor/document-save-adapter";
import { useTiptapPreview } from "~/components/editor/editor-frontend-provider";
import {
  PageEditorDraftContext,
  usePageDraft,
} from "~/components/editor/page-drafts-provider";
import { TiptapEditor } from "~/components/editor/tiptap-editor";
import { useBlockEditor } from "~/components/editor/use-block-editor";
import { ReferenceBacklinks } from "~/components/references/reference-backlinks";
import { PageCreatedEvent } from "~/events/page-created-event";
import { useAppEventHandler } from "~/hooks/use-app-event-handler";
import { useJournlAgent } from "~/hooks/use-journl-agent";
import type { BlockTransaction } from "~/trpc";

const DEFAULT_DEBOUNCE_TIME = 1000;

type PageEditorProps = Omit<
  React.ComponentProps<typeof BlockEditor>,
  "editor" | "onChange" | "formattingToolbar" | "slashMenu"
> & {
  page: Page;
  initialBlocks: [DocumentBlock, ...DocumentBlock[]] | undefined;
  debounceTime?: number;
};

export function PageEditor(props: PageEditorProps) {
  return useTiptapPreview() ? (
    <TiptapPagePreview {...props} />
  ) : (
    <BlockNotePageEditor {...props} />
  );
}

function TiptapPagePreview(props: PageEditorProps) {
  const { draft, retainDraft } = usePageDraft(props.page, {
    blocks: props.initialBlocks,
    documentId: props.page.document_id,
    title: props.page.title,
    updatedAt: props.page.updated_at,
  });
  const snapshot = useSyncExternalStore(
    draft.subscribe,
    draft.getSnapshot,
    draft.getSnapshot,
  );
  useEffect(
    () => () => {
      void draft.flush();
    },
    [draft],
  );
  return (
    <PageEditorDraftContext.Provider value={draft}>
      <TiptapEditor
        key={snapshot.resetKey}
        initialBlocks={snapshot.blocks}
        onCommit={(blocks, operations) => {
          const change = acceptedDocumentChange(
            draft.getSnapshot().blocks ?? [],
            blocks,
            operations,
          );
          retainDraft();
          draft.update(
            change.blocks,
            change.transactions,
            props.debounceTime ?? DEFAULT_DEBOUNCE_TIME,
          );
        }}
        className={props.className}
      >
        {props.children}
      </TiptapEditor>
      <ReferenceBacklinks documentId={props.page.document_id} />
    </PageEditorDraftContext.Provider>
  );
}

function BlockNotePageEditor({
  page,
  initialBlocks,
  debounceTime = DEFAULT_DEBOUNCE_TIME,
  ...rest
}: PageEditorProps) {
  const { draft, retainDraft } = usePageDraft(page, {
    blocks: initialBlocks,
    documentId: page.document_id,
    title: page.title,
    updatedAt: page.updated_at,
  });
  const snapshot = useSyncExternalStore(
    draft.subscribe,
    draft.getSnapshot,
    draft.getSnapshot,
  );
  const { setEditor, unsetEditor, setView } = useJournlAgent();
  const editor = useBlockEditor({
    initialBlocks: snapshot.blocks,
    resetKey: snapshot.resetKey,
  });
  function handleEditorChange(transactions: BlockTransaction[]) {
    retainDraft();
    draft.update(
      fromBlockNoteBlocks(editor.document),
      transactions,
      debounceTime,
    );
  }

  useEffect(
    () => () => {
      void draft.flush();
    },
    [draft],
  );

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
    <PageEditorDraftContext.Provider value={draft}>
      <BlockEditor
        key={snapshot.resetKey}
        editor={editor}
        onChange={handleEditorChange}
        // Disabling the default because we're using a formatting toolbar with the AI option.
        formattingToolbar={false}
        // Disabling the default because we're using a slash menu with the AI option.
        slashMenu={false}
        {...rest}
      />
      <ReferenceBacklinks documentId={page.document_id} />
    </PageEditorDraftContext.Provider>
  );
}
