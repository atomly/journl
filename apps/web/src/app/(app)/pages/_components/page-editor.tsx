"use client";

import type { Page } from "@acme/db/schema";
import type { DocumentBlock } from "@acme/document";
import type { Editor } from "@tiptap/core";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { ConnectedDocumentEditor } from "~/components/editor/document-editor";
import { acceptedDocumentChange } from "~/components/editor/document-save-adapter";
import {
  PageEditorDraftContext,
  usePageDraft,
} from "~/components/editor/page-drafts-provider";
import { ReferenceBacklinks } from "~/components/references/reference-backlinks";
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
  const editor = useRef<Editor | null>(null);
  const { draft, retainDraft } = usePageDraft(props.page, {
    blocks: props.initialBlocks,
    documentId: props.page.document_id,
    title: props.page.title,
    updatedAt: props.page.updated_at,
  });
  const { setView } = useJournlAgent();
  useEffect(() => {
    setView({ id: props.page.id, name: "page", title: props.page.title });
  }, [props.page.id, props.page.title, setView]);
  useEffect(() => () => setView({ name: "other" }), [setView]);
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
      <div
        className="flex flex-1 flex-col pb-52"
        data-page-writing-canvas=""
        onPointerDown={(event) => {
          const current = editor.current;
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            !event.isPrimary ||
            !current ||
            current.isDestroyed ||
            !current.isEditable ||
            !(event.target instanceof Element) ||
            event.target.closest(
              'a,button,input,textarea,select,[contenteditable],[role="button"],[data-tiptap-controls],[data-page-backlinks]',
            ) ||
            !current.isEmpty
          )
            return;
          current.commands.focus("start");
        }}
      >
        <ConnectedDocumentEditor
          key={snapshot.resetKey}
          agentEditorId={`page:${props.page.id}`}
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
          onReady={(instance) => {
            editor.current = instance;
            props.onReady?.(instance);
          }}
        >
          {props.children}
        </ConnectedDocumentEditor>
        <div data-page-backlinks="">
          <ReferenceBacklinks documentId={props.page.document_id} />
        </div>
      </div>
    </PageEditorDraftContext.Provider>
  );
}
