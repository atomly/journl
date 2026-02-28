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
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  Square,
} from "lucide-react";
import type { ComponentProps, FocusEvent, ReactNode } from "react";
import { MarkdownText } from "~/components/assistant-ui/markdown-text";
import { useThreadRuntime } from "~/components/assistant-ui/thread-runtime";
import { TooltipIconButton } from "~/components/assistant-ui/tooltip-icon-button";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import { getHumanReadableChatError } from "~/usage/quota-error";

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
  const partsLength = useAuiState((s) => s.chainOfThought.parts.length);
  const latestPart = useAuiState(
    (s) => s.chainOfThought.parts[s.chainOfThought.parts.length - 1],
  );

  if (partsLength === 0) {
    return null;
  }

  return (
    <ChainOfThoughtPrimitive.Root className="mt-3 mb-8 overflow-hidden rounded-lg border border-border/70 bg-background">
      <div className="p-4">
        <ChainOfThoughtPrimitive.AccordionTrigger className="flex w-full items-center gap-2 text-left">
          <MessagePrimitive.If assistant last>
            <ThreadPrimitive.If running>
              <span className="inline-block size-2 animate-pulse rounded-full bg-primary" />
            </ThreadPrimitive.If>

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

          <span className="ml-auto text-muted-foreground text-xs">
            {collapsed ? "Show" : "Hide"}
          </span>
        </ChainOfThoughtPrimitive.AccordionTrigger>
      </div>

      {collapsed ? (
        <p
          className={cn(
            "px-4 pb-3 text-muted-foreground text-sm",
            isThinking && "animate-text-shimmer",
          )}
        >
          {summarizeThoughtPart(latestPart)}
        </p>
      ) : (
        <div className="px-3 pb-3">
          <div className="space-y-3 pl-3">
            <ChainOfThoughtPrimitive.Parts
              components={{
                Layout: ThoughtStep,
                Reasoning: ThoughtReasoning,
                tools: {
                  Fallback: ThoughtTool,
                },
              }}
            />
          </div>
        </div>
      )}
    </ChainOfThoughtPrimitive.Root>
  );
}

function ThoughtStep({ children }: { children?: ReactNode }) {
  return (
    <div
      className={cn(
        "relative pl-3",
        "before:absolute before:top-0 before:-left-2 before:size-2 before:rounded-full before:bg-sidebar-border",
        "-after:translate-y-1/2 after:absolute after:top-0 after:-left-[0.275rem] after:my-4 after:size-px after:h-[calc(100%-1.5rem)] after:bg-sidebar-border",
      )}
    >
      {children}
    </div>
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
  argsText,
  isError,
  result,
  status,
  toolName,
}: ToolCallMessagePartProps) {
  const statusLabel = getToolStatusLabel(status.type);
  const actionLabel = describeToolAction(toolName, argsText);
  const resultSummary = summarizeToolResult(result);
  const resultTags = extractToolResultTags(result);

  return (
    <div className="rounded-lg pr-3 pb-3 pl-1">
      <div className="flex items-start justify-between gap-4">
        <span
          className={cn(
            "font-medium text-sm",
            status.type === "running" && "animate-text-shimmer",
          )}
        >
          {actionLabel}
        </span>
        <span className="text-muted-foreground text-xs">{statusLabel}</span>
      </div>
      {resultSummary ? (
        <p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
          {resultSummary}
        </p>
      ) : null}
      {resultTags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {resultTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full border border-border/70 bg-muted/60 px-2 py-0.5 text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
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
    const argsText =
      "argsText" in part && typeof part.argsText === "string"
        ? part.argsText
        : "";

    return describeToolAction(toolName, argsText);
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

function getToolStatusLabel(status: string) {
  if (status === "running") return "Running";
  if (status === "requires-action") return "Needs action";
  if (status === "incomplete") return "Incomplete";
  return "Complete";
}

// TODO: Find a way to avoid breaking this in the future in case we change or add new tools.
// These should be coupled somehow.
function describeToolAction(toolName: string, argsText: string) {
  const query = extractQuery(argsText);

  if (toolName === "semanticJournalSearch") {
    return query ? `Searching journal for ${query}` : "Searching journal";
  }

  if (toolName === "semanticPageSearch") {
    return query ? `Searching pages for ${query}` : "Searching pages";
  }

  if (toolName === "temporalJournalSearch") {
    return query
      ? `Searching journal timeline for ${query}`
      : "Searching timeline";
  }

  if (toolName === "navigateJournalEntry") {
    return "Opening journal entry";
  }

  if (toolName === "navigatePage") {
    return "Opening page";
  }

  if (toolName === "createPage") {
    return query ? `Creating page ${query}` : "Creating page";
  }

  if (toolName === "manipulateEditor") {
    return "Updating editor";
  }

  return `Running ${humanizeToolName(toolName)}`;
}

function extractQuery(argsText: string) {
  try {
    const parsed = JSON.parse(argsText) as Record<string, unknown>;
    if (typeof parsed.query === "string" && parsed.query.trim().length > 0) {
      const normalized = parsed.query.trim().replace(/\s+/g, " ");
      return `"${truncate(normalized, 48)}"`;
    }

    if (typeof parsed.title === "string" && parsed.title.trim().length > 0) {
      return `"${truncate(parsed.title.trim(), 48)}"`;
    }
  } catch {
    // Ignore non-JSON args.
  }

  return "";
}

function summarizeToolResult(value: unknown) {
  if (Array.isArray(value)) {
    const noun = value.length === 1 ? "result" : "results";
    return `${value.length} ${noun} returned`;
  }

  if (typeof value === "string") {
    return truncate(value.replace(/\s+/g, " ").trim(), 120);
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length > 0) {
      return `Returned fields: ${keys.slice(0, 4).join(", ")}`;
    }
  }

  return null;
}

function extractToolResultTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const tags: string[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const candidate = item as Record<string, unknown>;

    if (typeof candidate.page_title === "string") {
      tags.push(truncate(candidate.page_title, 28));
    } else if (typeof candidate.date === "string") {
      tags.push(candidate.date);
    } else if (typeof candidate.link === "string") {
      tags.push(getHost(candidate.link));
    }

    if (tags.length >= 4) {
      break;
    }
  }

  return Array.from(new Set(tags));
}

function humanizeToolName(toolName: string) {
  return toolName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .toLowerCase();
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
