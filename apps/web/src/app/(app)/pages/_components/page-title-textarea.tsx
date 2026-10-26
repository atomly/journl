"use client";

import type { Page } from "@acme/db/schema";
import { useRef, useSyncExternalStore } from "react";
import { usePageEditorDraft } from "~/components/editor/page-drafts-provider";
import { ExpandingTextarea } from "~/components/ui/expanding-textarea";
import { PageCreatedEvent } from "~/events/page-created-event";
import { useAppEventHandler } from "~/hooks/use-app-event-handler";
import { cn } from "~/lib/cn";

const DEFAULT_PLACEHOLDER = "New page";
const DEFAULT_DEBOUNCE_TIME = 1000;
const MAX_TITLE_LENGTH = 100;

type PageEditorTitleProps = {
  page: Pick<Page, "id" | "node_id" | "parent_node_id" | "title">;
  placeholder?: string;
  className?: string;
  debounceTime?: number;
  onTitleChange?: (title: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
} & Omit<React.ComponentProps<"textarea">, "value" | "onChange" | "onKeyDown">;

export function PageTitleTextarea({
  page,
  placeholder = DEFAULT_PLACEHOLDER,
  className,
  debounceTime = DEFAULT_DEBOUNCE_TIME,
  onTitleChange,
  onKeyDown,
  ...rest
}: PageEditorTitleProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const { draft, retainDraft } = usePageEditorDraft();
  const snapshot = useSyncExternalStore(
    draft.subscribe,
    draft.getSnapshot,
    draft.getSnapshot,
  );
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    retainDraft(page.id);
    draft.updateTitle(e.target.value, debounceTime);
    onTitleChange?.(e.target.value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    onKeyDown?.(e);
    if (
      e.defaultPrevented ||
      e.key !== "Tab" ||
      e.shiftKey ||
      e.altKey ||
      e.ctrlKey ||
      e.metaKey
    )
      return;
    const content = e.currentTarget
      .closest("[data-editor-frontend]")
      ?.querySelector<HTMLElement>('[role="textbox"][contenteditable="true"]');
    if (content) {
      e.preventDefault();
      content.focus();
    }
  }

  useAppEventHandler(
    ({ payload }) => {
      if (!payload.title && ref.current) {
        ref.current.focus();
      }
    },
    [PageCreatedEvent, page.id],
  );

  return (
    <ExpandingTextarea
      ref={ref}
      value={snapshot.title ?? page.title}
      rows={1}
      maxLength={MAX_TITLE_LENGTH}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={cn(
        "border-none! bg-transparent! font-bold! text-3xl! shadow-none outline-none! ring-0! placeholder:text-muted-foreground/60 md:text-4xl! lg:text-5xl!",
        className,
      )}
      {...rest}
    />
  );
}
