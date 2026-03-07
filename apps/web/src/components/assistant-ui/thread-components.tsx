"use client";

import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ChainOfThoughtPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  type ReasoningMessagePartProps,
  ThreadPrimitive,
  type ToolCallMessagePartProps,
  useAuiState,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  Square,
} from "lucide-react";
import { type ComponentProps, type FocusEvent, useMemo } from "react";
import type { Tools } from "~/ai/mastra/agents/journl-agent";
import { MarkdownText } from "~/components/assistant-ui/markdown-text";
import { useThreadRuntime } from "~/components/assistant-ui/thread-runtime";
import { TooltipIconButton } from "~/components/assistant-ui/tooltip-icon-button";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import { getHumanReadableChatError } from "~/usage/quota-error";

type ToolResultListItem = {
  date?: string;
  link?: string;
  page_title?: string;
};

type ToolResultObject = Record<string, unknown> & {
  action?: {
    type?: string;
  };
  message?: string;
  sources?: unknown[];
};

type ToolResultValue =
  | string
  | ToolResultListItem[]
  | ToolResultObject
  | null
  | undefined;

type ThreadScrollToBottomProps = Partial<
  ComponentProps<typeof TooltipIconButton>
>;

export function ThreadScrollToBottom({
  className,
  tooltip = "Scroll to bottom",
  variant = "outline",
  ...props
}: ThreadScrollToBottomProps) {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip={tooltip}
        variant={variant}
        className={cn(
          "absolute -top-12 size-10! rounded-full bg-background! disabled:invisible",
          className,
        )}
        {...props}
      >
        <ArrowDownIcon className="size-6" />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
}

export function ComposerInput({
  className,
  placeholder = "Ask anything...",
  ...rest
}: ComponentProps<typeof ComposerPrimitive.Input>) {
  const { exceeded } = useThreadRuntime();
  const isUsageQuotaExceeded = Boolean(exceeded);

  return (
    <ComposerPrimitive.Input
      rows={1}
      disabled={isUsageQuotaExceeded || rest.disabled}
      placeholder={
        isUsageQuotaExceeded
          ? "You've reached your AI limit. Upgrade to continue."
          : placeholder
      }
      className={cn(
        "max-h-40 grow resize-none border-none text-md outline-none placeholder:text-muted-foreground focus:ring-0 disabled:cursor-not-allowed",
        className,
      )}
      {...rest}
    />
  );
}

type ComposerActionProps = {
  className?: string;
  tooltip?: string;
  variant?: ComponentProps<typeof TooltipIconButton>["variant"];
};

export function ComposerAction({
  className,
  tooltip = "Send",
  variant = "default",
}: ComposerActionProps) {
  const { exceeded } = useThreadRuntime();
  const isUsageQuotaExceeded = Boolean(exceeded);

  return (
    <>
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            disabled={isUsageQuotaExceeded}
            tooltip={isUsageQuotaExceeded ? "Usage limit reached" : tooltip}
            variant={variant}
            className={cn("size-8 p-2 transition-opacity ease-in", className)}
          >
            <ArrowUpIcon className="size-4 text-foreground!" />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <TooltipIconButton
            tooltip="Cancel"
            variant={variant}
            className={cn("size-8 p-2 transition-opacity ease-in", className)}
          >
            <Square className="text-foreground!" />
          </TooltipIconButton>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </>
  );
}

type ComposerQuotaNoticeProps = {
  className?: string;
};
export function ComposerQuotaNotice({ className }: ComposerQuotaNoticeProps) {
  const { exceeded } = useThreadRuntime();

  if (!exceeded) {
    return null;
  }

  const { usage } = exceeded;
  const planLabel = usage.subscriptionType === "pro" ? "Pro" : "Free";
  const resetAt = formatDate(usage.periodEnd);

  return (
    <div
      className={cn(
        "mx-2 rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 dark:border-amber-800/80 dark:bg-amber-950/20",
        className,
      )}
    >
      <p className="font-medium text-amber-900 text-xs dark:text-amber-200">
        AI usage limit reached
      </p>
      <p className="text-amber-900/90 text-xs dark:text-amber-100/90">
        You’ve used all of your {planLabel} plan usage.{" "}
        {usage.subscriptionType === "free" ? "Upgrade now or wait" : "Wait"}{" "}
        until your next {resetAt ? `reset on ${resetAt}` : "reset"}.
      </p>
    </div>
  );
}

export function UserMessage() {
  return (
    <MessagePrimitive.Root className="grid w-full max-w-(--thread-max-width) auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 pb-4 [&:where(>*)]:col-start-2">
      <ActionBarPrimitive.Root
        hideWhenRunning
        autohide="not-last"
        className="col-start-1 row-start-2 mt-1.5 mr-3 flex flex-col items-end"
      >
        <ActionBarPrimitive.Edit asChild>
          <TooltipIconButton tooltip="Edit">
            <PencilIcon />
          </TooltipIconButton>
        </ActionBarPrimitive.Edit>
      </ActionBarPrimitive.Root>

      <div className="wrap-break-word col-start-2 row-start-2 max-w-[calc(var(--thread-max-width)*0.9)] rounded-3xl bg-background px-5 py-2.5 text-foreground">
        <MessagePrimitive.Content />
      </div>

      <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
    </MessagePrimitive.Root>
  );
}

const EDIT_FOCUS_DELAY = 160;

export function EditComposer() {
  function handleFocus(event: FocusEvent<HTMLTextAreaElement, Element>) {
    const target = event.currentTarget;
    const scrollIntoView = () => {
      target.scrollIntoView({
        behavior: "auto",
        block: "center",
        inline: "nearest",
      });
    };

    window.requestAnimationFrame(scrollIntoView);
    window.setTimeout(scrollIntoView, EDIT_FOCUS_DELAY);
  }

  return (
    <ComposerPrimitive.Root className="my-4 flex w-full max-w-(--thread-max-width) flex-col gap-2 rounded-xl bg-background">
      <ComposerPrimitive.Input
        autoFocus
        onFocus={handleFocus}
        className="flex h-8 w-full resize-none bg-transparent p-4 pb-0 text-foreground outline-none"
      />

      <div className="mx-3 mb-3 flex items-center justify-center gap-2 self-end">
        <ComposerPrimitive.Cancel asChild>
          <Button variant="ghost">Cancel</Button>
        </ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send asChild>
          <Button>Send</Button>
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  );
}

export function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="relative grid w-full max-w-(--thread-max-width) grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr] pb-10">
      <div className="wrap-break-word col-span-2 col-start-2 row-start-1 max-w-[calc(var(--thread-max-width)*0.9)] text-foreground leading-7">
        <MessagePrimitive.Content
          components={{
            ChainOfThought: AssistantThinking,
            Text: AssistantText,
          }}
        />
        <MessagePrimitive.Error>
          <ErrorPrimitive.Root className="mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-200">
            <ErrorPrimitive.Message className="line-clamp-3">
              <AssistantErrorMessage />
            </ErrorPrimitive.Message>
          </ErrorPrimitive.Root>
        </MessagePrimitive.Error>
      </div>

      <AssistantActionBar />

      <BranchPicker className="col-start-2 row-start-2 mr-2 -ml-2" />
    </MessagePrimitive.Root>
  );
}

function AssistantErrorMessage() {
  const error = useAuiState((s) =>
    s.message.status?.type === "incomplete" &&
    s.message.status.reason === "error"
      ? s.message.status.error
      : undefined,
  );

  if (error === undefined) {
    return null;
  }

  return getHumanReadableChatError(error);
}

function AssistantText() {
  const hasToolCalls = useAuiState((s) => {
    const parts = s.message.parts as ReadonlyArray<{ type?: string }>;
    return parts.some((part) => part.type === "tool-call");
  });

  return (
    <>
      <MarkdownText />
      <MessagePrimitive.If assistant last>
        {!hasToolCalls ? (
          <MessagePartPrimitive.InProgress>
            <span className="ml-2 inline-block size-2.5 animate-pulse rounded-full bg-foreground/70 align-middle" />
          </MessagePartPrimitive.InProgress>
        ) : null}
      </MessagePrimitive.If>
    </>
  );
}

function AssistantThinking() {
  const collapsed = useAuiState((s) => s.chainOfThought.collapsed);
  const isThinking = useAuiState(
    (s) => s.chainOfThought.status.type === "running",
  );
  const parts = useAuiState((s) => {
    return s.chainOfThought.parts;
  });
  const latestPart = useAuiState(
    (s) => s.chainOfThought.parts[s.chainOfThought.parts.length - 1],
  );

  const toolCalls = useMemo(() => {
    const actions: Array<{ id: string; label: string }> = [];

    for (const part of parts) {
      if (part.type !== "tool-call") {
        continue;
      }

      const {
        toolName,
        argsText,
        status: { type },
      } = part;

      actions.push({
        id: `${toolName}:${argsText}:${type}:${actions.length + 1}`,
        label: getToolAction(toolName),
      });
    }

    return actions;
  }, [parts]);

  if (!toolCalls) return null;

  const collapsedEntries =
    toolCalls.length > 0
      ? toolCalls
      : [{ id: "latest", label: summarizeThoughtPart(latestPart) }];
  const lastCollapsedEntryId =
    collapsedEntries[collapsedEntries.length - 1]?.id;

  return (
    <ChainOfThoughtPrimitive.Root className="mt-3 mb-8 space-y-2 overflow-hidden rounded-lg border border-border/70 bg-background px-2.5 py-4">
      <ChainOfThoughtPrimitive.AccordionTrigger className="flex w-full items-center gap-1.5 text-left">
        <ChevronDownIcon
          className={cn(
            "size-3 shrink-0 text-muted-foreground transition-transform duration-200 ease-out",
            collapsed && "-rotate-90",
          )}
        />

        <MessagePrimitive.If assistant last>
          <ThreadPrimitive.If running>
            <span className="animate-text-shimmer font-medium text-sm">
              Thinking
            </span>
          </ThreadPrimitive.If>

          <ThreadPrimitive.If running={false}>
            <span className="font-medium text-sm">Results</span>
          </ThreadPrimitive.If>
        </MessagePrimitive.If>

        <MessagePrimitive.If assistant last={false}>
          <span className="font-medium text-sm">Results</span>
        </MessagePrimitive.If>
      </ChainOfThoughtPrimitive.AccordionTrigger>

      <div className="relative pl-5">
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 left-1.5 w-px -translate-x-1/2 bg-sidebar-border"
        />
        <div className={collapsed ? "block" : "hidden"}>
          {collapsedEntries.map((action) => (
            <p
              key={action.id}
              className={cn(
                "line-clamp-1 py-1 text-muted-foreground text-sm",
                isThinking &&
                  action.id === lastCollapsedEntryId &&
                  "animate-text-shimmer",
              )}
            >
              {action.label}
            </p>
          ))}
        </div>
        <div className={cn("space-y-2", collapsed ? "hidden" : "block")}>
          <ChainOfThoughtPrimitive.Parts
            components={{
              Reasoning: ThoughtReasoning,
              tools: {
                Fallback: ThoughtTool,
              },
            }}
          />
        </div>
      </div>
    </ChainOfThoughtPrimitive.Root>
  );
}

function ThoughtReasoning({ text }: ReasoningMessagePartProps) {
  const isThinking = useAuiState(
    (s) => s.chainOfThought.status.type === "running",
  );
  const normalized = text.replace(/\s+/g, " ").trim();
  return (
    <p
      className={cn("text-sm leading-6", isThinking && "animate-text-shimmer")}
    >
      {normalized}
    </p>
  );
}

function ThoughtTool({
  isError,
  result,
  status,
  toolName,
}: ToolCallMessagePartProps<unknown, ToolResultValue>) {
  const actionLabel = getToolAction(toolName);
  const resultSummary = summarizeToolResult(result);
  const resultTags = extractToolResultTags(result);

  return (
    <div className="space-y-1 py-1">
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "font-medium text-sm",
            status.type === "running" && "animate-text-shimmer",
          )}
        >
          {actionLabel}
        </span>
      </div>
      {resultSummary && (
        <p className="text-muted-foreground text-xs">{resultSummary}</p>
      )}
      {resultTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {resultTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full border border-border/70 bg-sidebar-border px-2 py-0.5 text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      {isError && <p className="mt-1 text-destructive text-xs">Tool failed</p>}
    </div>
  );
}

function AssistantActionBar() {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="col-start-3 row-start-2 -ml-1 flex gap-1 text-muted-foreground data-floating:absolute data-floating:rounded-md data-floating:border data-floating:bg-background data-floating:shadow-sm"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <MessagePrimitive.If copied>
            <CheckIcon />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon />
          </MessagePrimitive.If>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Refresh">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
}

function BranchPicker({
  className,
  ...rest
}: BranchPickerPrimitive.Root.Props) {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "inline-flex items-center text-muted-foreground text-xs",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
}

function summarizeThoughtPart(part: unknown) {
  if (!part || typeof part !== "object") {
    return "Working...";
  }

  if ("type" in part && part.type === "tool-call") {
    const toolName =
      "toolName" in part && typeof part.toolName === "string"
        ? part.toolName
        : "tool";

    return getToolAction(toolName);
  }

  if (
    "type" in part &&
    part.type === "reasoning" &&
    "text" in part &&
    typeof part.text === "string"
  ) {
    return truncate(part.text.replace(/\s+/g, " ").trim(), 120);
  }

  return "Working...";
}

const toolActionMap: Record<string, string> = {
  applyChanges: "Accepting changes",
  createPage: "Creating page",
  navigateJournalEntry: "Opening journal",
  navigatePage: "Opening page",
  rejectChanges: "Rejecting changes",
  semanticJournalSearch: "Searching entries",
  semanticPageSearch: "Searching pages",
  temporalJournalSearch: "Reading journal",
  webSearch: "Searching web",
  write: "Writing content",
} satisfies Record<Tools, string>;

function getToolAction(toolName: string) {
  if (toolName in toolActionMap) {
    return toolActionMap[toolName] ?? `Running ${humanizeToolName(toolName)}`;
  }
  return `Running ${humanizeToolName(toolName)}`;
}

function humanizeToolName(toolName: string) {
  return toolName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .toLowerCase();
}

function summarizeToolResult(value: ToolResultValue) {
  if (Array.isArray(value)) {
    const noun = value.length === 1 ? "result" : "results";
    return `${value.length} ${noun} returned`;
  }

  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return truncate(value.replace(/\s+/g, " ").trim(), 120);
  }

  if (typeof value.message === "string") {
    return truncate(value.message.replace(/\s+/g, " ").trim(), 120);
  }

  if (value.action?.type === "search") {
    const sourceCount = value.sources?.length ?? 0;
    const noun = sourceCount === 1 ? "source" : "sources";

    return sourceCount > 0
      ? `${sourceCount} ${noun} returned`
      : "Web search completed";
  }

  const keys = Object.keys(value);
  if (keys.length > 0) {
    return `Returned fields: ${keys.slice(0, 4).join(", ")}`;
  }

  return null;
}

function extractToolResultTags(value: ToolResultValue) {
  if (!Array.isArray(value)) {
    return [];
  }

  const tags: string[] = [];

  for (const item of value) {
    if (typeof item.page_title === "string") {
      tags.push(truncate(item.page_title, 28));
    } else if (typeof item.date === "string") {
      tags.push(item.date);
    } else if (typeof item.link === "string") {
      tags.push(getHost(item.link));
    }

    if (tags.length >= 4) {
      break;
    }
  }

  return Array.from(new Set(tags));
}

function getHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function truncate(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  try {
    return `${value.slice(0, limit - 1)}…`;
  } catch {
    return value;
  }
}

function formatDate(date: string | null) {
  if (!date) {
    return undefined;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}
