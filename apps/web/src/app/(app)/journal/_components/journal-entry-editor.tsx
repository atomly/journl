"use client";

import type { PartialBlock } from "@blocknote/core";
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
import { useBlockEditor } from "~/components/editor/use-block-editor";
import { Button } from "~/components/ui/button";
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
  initialBlocks: [PartialBlock, ...PartialBlock[]] | undefined;
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
  const { formattedDate, isToday } = useJournalEntry();

  return (
    <div className={className} {...rest}>
      <h2 className="font-semibold text-3xl text-muted-foreground md:text-4xl lg:text-5xl">
        {isToday && !forceDate ? "Today" : formattedDate}
      </h2>
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

export function JournalEntryEditor({
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

  async function downloadDraft(blocks = editor.document as PartialBlock[]) {
    const markdown = await editor.blocksToMarkdownLossy(blocks);
    const url = URL.createObjectURL(
      new Blob([markdown], { type: "text/markdown" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `journal-${date}-draft.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleEditorChange(transactions: BlockTransaction[]) {
    retainDraft();
    draft.update(editor.document, transactions, debounceTime, onCreateAction);
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
      {Boolean(snapshot.error) && (
        <div
          role="alert"
          className="mx-8 mt-4 rounded-md border border-destructive/50 p-3 text-sm"
        >
          <p>
            {snapshot.conflict
              ? "This entry changed elsewhere. Your draft is still here; download it before loading the saved entry."
              : "Your latest changes haven’t been saved. Your draft is still here."}
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={snapshot.isSaving}
              onClick={() => void draft.retry()}
            >
              {snapshot.isSaving ? "Retrying…" : "Retry save"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void downloadDraft()}
            >
              Download draft
            </Button>
            {snapshot.conflict && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={snapshot.isSaving}
                onClick={async () => {
                  const blocks = draft.getSnapshot().blocks;
                  await downloadDraft(blocks);
                  await draft.loadSaved(blocks);
                }}
              >
                Download draft and load saved entry
              </Button>
            )}
          </div>
        </div>
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
