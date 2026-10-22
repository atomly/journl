"use client";

import { fromBlockNoteBlocks } from "@acme/blocknote/adapter";
import type { DocumentBlock } from "@acme/document";
import Link from "next/link";
import {
  type ComponentProps,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { BlockEditor } from "~/components/editor/block-editor";
import { useTiptapPreview } from "~/components/editor/editor-frontend-provider";
import { TiptapEditor } from "~/components/editor/tiptap-editor";
import { useBlockEditor } from "~/components/editor/use-block-editor";
import { ExploreNoteLink } from "~/components/references/explore-note-link";
import { ReferenceBacklinks } from "~/components/references/reference-backlinks";
import { useJournlAgent } from "~/hooks/use-journl-agent";
import { cn } from "~/lib/cn";
import { formatDate } from "~/lib/format-date";
import type { BlockTransaction, JournalListEntry } from "~/trpc";
import { useJournalEntryDraft } from "./journal-drafts-provider";

const DEFAULT_DEBOUNCE_TIME = 1000;

type JournalEntryContextValue = {
  documentId: string | null;
  updatedAt: string | null;
  date: string;
  formattedDate: string;
  initialBlocks: [DocumentBlock, ...DocumentBlock[]] | undefined;
  isToday: boolean;
};

const JournalEntryContext = createContext<JournalEntryContextValue | undefined>(
  undefined,
);

type JournalEntryProviderProps = ComponentProps<"div"> & {
  entry: JournalListEntry;
};

export function JournalEntryProvider({
  className,
  children,
  entry,
  ...rest
}: JournalEntryProviderProps) {
  const value = useMemo(() => {
    const date = new Date(`${entry.date}T00:00:00`);
    const now = new Date();
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    const formattedDate = formatDate(date);
    return {
      date: entry.date,
      documentId: "document_id" in entry ? entry.document_id : null,
      formattedDate,
      initialBlocks: "blocks" in entry ? entry.blocks : undefined,
      isToday,
      updatedAt: "updated_at" in entry ? entry.updated_at : null,
    };
  }, [entry]);

  return (
    <JournalEntryContext.Provider value={value}>
      <div
        className={cn(value.isToday && "min-h-96 md:min-h-124", className)}
        {...rest}
      >
        {children}
      </div>
    </JournalEntryContext.Provider>
  );
}

function useJournalEntry() {
  const context = useContext(JournalEntryContext);
  if (!context) {
    throw new Error(
      "useJournalEntry must be used within a JournalEntryProvider",
    );
  }
  return context;
}

type JournalEntryWrapperProps = ComponentProps<"div">;

export function JournalEntryWrapper({
  className,
  children,
  ...rest
}: JournalEntryWrapperProps) {
  const { isToday } = useJournalEntry();

  return (
    <div
      className={cn(isToday && "min-h-96 md:min-h-124", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function JournalEntryLink({ className, ...rest }: ComponentProps<"a">) {
  const { date } = useJournalEntry();

  return (
    <Link
      className={cn("text-muted-foreground", className)}
      href={`/journal/${date}`}
      {...rest}
    />
  );
}

type JournalEntryHeaderProps = Omit<ComponentProps<"div">, "children"> & {
  forceDate?: boolean;
};

export function JournalEntryHeader({
  className,
  forceDate = false,
  ...rest
}: JournalEntryHeaderProps) {
  const { formattedDate, isToday, documentId } = useJournalEntry();

  return (
    <div className={cn("flex items-start gap-3", className)} {...rest}>
      <h2 className="min-w-0 flex-1 font-semibold text-3xl text-muted-foreground md:text-4xl lg:text-5xl">
        {isToday && !forceDate ? "Today" : formattedDate}
      </h2>
      {documentId && <ExploreNoteLink documentId={documentId} />}
    </div>
  );
}

type JournalEntryEditorProps = Omit<
  React.ComponentProps<typeof BlockEditor>,
  "editor" | "onChange" | "formattingToolbar" | "slashMenu"
> & {
  debounceTime?: number;
  onCreateAction?: (newEntry: JournalListEntry) => void;
};

export function JournalEntryEditor(props: JournalEntryEditorProps) {
  const tiptap = useTiptapPreview();
  const { initialBlocks } = useJournalEntry();
  return tiptap ? (
    <TiptapEditor initialBlocks={initialBlocks} className={props.className}>
      {props.children}
    </TiptapEditor>
  ) : (
    <BlockNoteJournalEntryEditor {...props} />
  );
}

function BlockNoteJournalEntryEditor({
  debounceTime = DEFAULT_DEBOUNCE_TIME,
  onCreateAction,
  ...rest
}: JournalEntryEditorProps) {
  const { initialBlocks, documentId, updatedAt, date } = useJournalEntry();
  const { draft, retainDraft } = useJournalEntryDraft(date, {
    blocks: initialBlocks,
    documentId,
    updatedAt,
  });
  const snapshot = useSyncExternalStore(
    draft.subscribe,
    draft.getSnapshot,
    draft.getSnapshot,
  );
  const { setEditor, unsetEditor } = useJournlAgent();
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
      onCreateAction,
    );
  }

  useEffect(
    () => () => {
      void draft.flush();
    },
    [draft],
  );

  useEffect(() => {
    const id = `journal-entry:${date}` as const;
    setEditor({ editor, id });
    return () => {
      unsetEditor(id);
    };
  }, [date, editor, setEditor, unsetEditor]);

  return (
    <>
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
      {snapshot.documentId && (
        <ReferenceBacklinks documentId={snapshot.documentId} />
      )}
    </>
  );
}

export function JournalEntryAgentView() {
  const { date } = useJournalEntry();
  const { setView } = useJournlAgent();

  useEffect(() => {
    setView({
      date,
      name: "journal-entry",
    });
    return () => {
      setView({
        name: "other",
      });
    };
  }, [date, setView]);

  return null;
}
