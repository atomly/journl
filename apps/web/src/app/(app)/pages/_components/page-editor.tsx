"use client";

import type { Page } from "@acme/db/schema";
import type { DocumentBlock } from "@acme/document";
import { useEffect, useSyncExternalStore } from "react";
import { ConnectedDocumentEditor } from "~/components/editor/document-editor";
import { acceptedDocumentChange } from "~/components/editor/document-save-adapter";
import {
  PageEditorDraftContext,
  usePageDraft,
} from "~/components/editor/page-drafts-provider";
import { ReferenceBacklinks } from "~/components/references/reference-backlinks";
import { PageCreatedEvent } from "~/events/page-created-event";
import { useAppEventHandler } from "~/hooks/use-app-event-handler";
import { useJournlAgent } from "~/hooks/use-journl-agent";

const DEFAULT_DEBOUNCE_TIME = 1000;

type PageEditorProps = Omit<
  React.ComponentProps<typeof ConnectedDocumentEditor>,
  "initialBlocks" | "onCommit"
> & {
  page: Page;
  initialBlocks: [DocumentBlock, ...DocumentBlock[]] | undefined;
  debounceTime?: number;
};

export function PageEditor(props: PageEditorProps) {
  const { draft, retainDraft } = usePageDraft(props.page, {
    blocks: props.initialBlocks,
    documentId: props.page.document_id,
    title: props.page.title,
    updatedAt: props.page.updated_at,
  });
  const { setView } = useJournlAgent();
  useEffect(() => {
    setView({ id: props.page.id, name: "page", title: props.page.title });
    return () => setView({ name: "other" });
  }, [props.page.id, props.page.title, setView]);
  useAppEventHandler(
    ({ payload }) => {
      if (payload.tool)
        void payload.tool.chat.addToolOutput({
          output: `Opened new page: ${payload.title}`,
          tool: payload.tool.toolName,
          toolCallId: payload.tool.toolCallId,
        });
    },
    [PageCreatedEvent, props.page.id],
  );
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
      <ConnectedDocumentEditor
        key={snapshot.resetKey}
        initialBlocks={snapshot.blocks}
        onCommit={(blocks, operations) => {
          const change = acceptedDocumentChange(
            draft.getSnapshot().blocks ?? [],
            blocks,
            operations,
          );
          retainDraft();
          draft.update(change, props.debounceTime ?? DEFAULT_DEBOUNCE_TIME);
        }}
        className={props.className}
      >
        {props.children}
      </ConnectedDocumentEditor>
      <ReferenceBacklinks documentId={props.page.document_id} />
    </PageEditorDraftContext.Provider>
  );
}
