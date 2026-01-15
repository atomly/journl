"use client";

import type { BlockTransaction, JournalListEntry } from "@acme/api";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import {
  type ComponentProps,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDebouncedCallback } from "use-debounce";
import { useJournlAgentAwareness } from "~/ai/agents/use-journl-agent-awareness";
import { BlockEditor } from "~/components/editor/block-editor";
import { BlockEditorErrorOverlay } from "~/components/editor/block-editor-error-overlay";
import {
  BlockEditorFormattingToolbar,
  BlockEditorSlashMenu,
} from "~/components/editor/block-editor-tools";
import { useBlockEditor } from "~/components/editor/use-block-editor";
import { cn } from "~/components/utils";
import { formatDate } from "~/lib/format-date";
import { useTRPC } from "~/trpc/react";

const DEFAULT_DEBOUNCE_TIME = 150;

type JournalEntryContextValue = {
  documentId: string | null;
  date: string;
  formattedDate: string;
  initialBlocks: Extract<JournalListEntry, { blocks?: unknown }>["blocks"];
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
    <div className={cn("mb-6", className)} {...rest}>
      <h2 className="font-semibold text-3xl text-muted-foreground md:text-4xl lg:text-5xl">
        {isToday && !forceDate ? "Today" : formattedDate}
      </h2>
    </div>
  );
}

type JournalEntryContentProps = ComponentProps<"div">;

export function JournalEntryContent({
  className,
  children,
  ...rest
}: JournalEntryContentProps) {
  return (
    <div className={cn("flex items-start gap-2", className)} {...rest}>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

type JournalEntryEditorProps = {
  debounceTime?: number;
  onCreateAction?: (newEntry: JournalListEntry) => void;
  onFocusAction?: () => void;
  onBlurAction?: () => void;
};

export function JournalEntryEditor({
  debounceTime = DEFAULT_DEBOUNCE_TIME,
  onCreateAction,
  onFocusAction: onFocus,
  onBlurAction: onBlur,
}: JournalEntryEditorProps) {
  const trpc = useTRPC();
  const pendingChangesRef = useRef<BlockTransaction[]>([]);
  const { initialBlocks, documentId, date } = useJournalEntry();
  const { rememberEditor, forgetEditor } = useJournlAgentAwareness();
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
    ...trpc.journal.saveTransactions.mutationOptions({}),
    onError: (error) => {
      console.error("[JournalEntryEditor] error 👀", error);
      handleError();
    },
    onSuccess: (data) => {
      if (pendingChangesRef.current.length > 0) {
        debouncedMutate();
      }
      if (!documentId && data) {
        onCreateAction?.(data);
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

  useEffect(() => {
    rememberEditor({ date, editor, type: "journal-entry" });
    return () => {
      forgetEditor(date);
    };
  }, [date, editor, rememberEditor, forgetEditor]);

  return (
    <>
      <BlockEditor
        editor={editor}
        initialBlocks={initialBlocks}
        onChange={handleEditorChange}
        onFocus={onFocus}
        onBlur={onBlur}
        // Disabling the default because we're using a formatting toolbar with the AI option.
        formattingToolbar={false}
        // Disabling the default because we're using a slash menu with the AI option.
        slashMenu={false}
      >
        <BlockEditorFormattingToolbar />
        <BlockEditorSlashMenu />
      </BlockEditor>
      <BlockEditorErrorOverlay isOpen={isOverlayOpen} />
    </>
  );
}

export function JournalEntryAgentView() {
  const { date } = useJournalEntry();
  const { rememberView: setView } = useJournlAgentAwareness();

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
