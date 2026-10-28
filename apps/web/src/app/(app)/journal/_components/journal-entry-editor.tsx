"use client";

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
import { ConnectedDocumentEditor } from "~/components/editor/document-editor";
import { acceptedDocumentChange } from "~/components/editor/document-save-adapter";
import { ExploreNoteLink } from "~/components/references/explore-note-link";
import { ReferenceBacklinks } from "~/components/references/reference-backlinks";
import { useJournlAgent } from "~/hooks/use-journl-agent";
import { cn } from "~/lib/cn";
import { formatDate } from "~/lib/format-date";
import type { JournalListEntry } from "~/trpc";
import { useJournalEntryDraft } from "./journal-drafts-provider";
import { JournalEntryConvertToPage } from "./journal-entry-convert-to-page";

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

type JournalEntryHeaderProps = Omit<ComponentProps<"div">, "children"> & {
  forceDate?: boolean;
  linkDate?: boolean;
};

export function JournalEntryHeader({
  className,
  forceDate = false,
  linkDate = false,
  ...rest
}: JournalEntryHeaderProps) {
  const { date, formattedDate, isToday, documentId, updatedAt } =
    useJournalEntry();
  const label = isToday && !forceDate ? "Today" : formattedDate;

  return (
    <div className={cn("flex items-start gap-3", className)} {...rest}>
      <h2 className="min-w-0 flex-1 font-semibold text-3xl text-muted-foreground md:text-4xl lg:text-5xl">
        {linkDate ? <Link href={`/journal/${date}`}>{label}</Link> : label}
      </h2>
      <div className="flex shrink-0 items-center gap-0">
        {documentId && <ExploreNoteLink documentId={documentId} />}
        {documentId && updatedAt && (
          <JournalEntryConvertToPage
            date={date}
            title={formattedDate}
            documentId={documentId}
            updatedAt={updatedAt}
          />
        )}
      </div>
    </div>
  );
}

type JournalEntryEditorProps = Omit<
  React.ComponentProps<typeof ConnectedDocumentEditor>,
  "initialBlocks" | "onCommit"
> & {
  debounceTime?: number;
  onCreateAction?: (newEntry: JournalListEntry) => void;
};

export function JournalEntryEditor(props: JournalEntryEditorProps) {
  const entry = useJournalEntry();
  const { initialBlocks, documentId, updatedAt, date } = entry;
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
  useEffect(
    () => () => {
      void draft.flush();
    },
    [draft],
  );
  return (
    <JournalEntryContext.Provider
      value={{
        ...entry,
        documentId: snapshot.documentId,
        updatedAt: snapshot.updatedAt,
      }}
    >
      <ConnectedDocumentEditor
        key={snapshot.resetKey}
        initialBlocks={snapshot.blocks}
        className={props.className}
        onCommit={(blocks, operations) => {
          const change = acceptedDocumentChange(
            draft.getSnapshot().blocks ?? [],
            blocks,
            operations,
          );
          retainDraft();
          draft.update(
            change,
            props.debounceTime ?? DEFAULT_DEBOUNCE_TIME,
            props.onCreateAction,
          );
        }}
      >
        {props.children}
      </ConnectedDocumentEditor>
      {snapshot.documentId && (
        <ReferenceBacklinks documentId={snapshot.documentId} />
      )}
    </JournalEntryContext.Provider>
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
