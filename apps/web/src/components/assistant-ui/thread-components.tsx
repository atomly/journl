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
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  SendHorizontalIcon,
  Square,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { MarkdownText } from "~/components/assistant-ui/markdown-text";
import { TooltipIconButton } from "~/components/assistant-ui/tooltip-icon-button";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";

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
  ...rest
}: ComponentProps<typeof ComposerPrimitive.Input>) {
  return (
    <ComposerPrimitive.Input
      rows={1}
      placeholder="Ask anything..."
      className={cn(
        "max-h-40 grow resize-none border-none py-4 text-md outline-none placeholder:text-muted-foreground focus:ring-0 disabled:cursor-not-allowed",
        className,
      )}
      {...rest}
    />
  );
}

export function ComposerAction() {
  return (
    <>
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="Send"
            variant="default"
            className="size-8 p-2 transition-opacity ease-in"
          >
            <SendHorizontalIcon />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <TooltipIconButton
            tooltip="Cancel"
            variant="default"
            className="size-8 p-2 transition-opacity ease-in"
          >
            <Square />
          </TooltipIconButton>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </>
  );
}

export function UserMessage() {
  return (
    <MessagePrimitive.Root className="grid w-full max-w-(--thread-max-width) auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 py-4 [&:where(>*)]:col-start-2">
      <ActionBarPrimitive.Root
        hideWhenRunning
        autohide="not-last"
        className="col-start-1 row-start-2 mt-2.5 mr-3 flex flex-col items-end"
      >
        <ActionBarPrimitive.Edit asChild>
          <TooltipIconButton tooltip="Edit">
            <PencilIcon />
          </TooltipIconButton>
        </ActionBarPrimitive.Edit>
      </ActionBarPrimitive.Root>

      <div className="wrap-break-word col-start-2 row-start-2 max-w-[calc(var(--thread-max-width)*0.9)] rounded-3xl bg-muted px-5 py-2.5 text-foreground">
        <MessagePrimitive.Content />
      </div>

      <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
    </MessagePrimitive.Root>
  );
}

export function EditComposer() {
  return (
    <ComposerPrimitive.Root className="my-4 flex w-full max-w-(--thread-max-width) flex-col gap-2 rounded-xl bg-muted">
      <ComposerPrimitive.Input className="flex h-8 w-full resize-none bg-transparent p-4 pb-0 text-foreground outline-none" />

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
    <MessagePrimitive.Root className="relative grid w-full max-w-(--thread-max-width) grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr]">
      <div className="wrap-break-word col-span-2 col-start-2 row-start-1 max-w-[calc(var(--thread-max-width)*0.9)] text-foreground leading-7">
        <MessagePrimitive.Content
          components={{
            ChainOfThought: AssistantThinking,
            Text: AssistantText,
          }}
        />
        <MessagePrimitive.Error>
          <ErrorPrimitive.Root className="mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-200">
            <ErrorPrimitive.Message className="line-clamp-2" />
          </ErrorPrimitive.Root>
        </MessagePrimitive.Error>
      </div>

      <AssistantActionBar />

      <BranchPicker className="col-start-2 row-start-2 mr-2 -ml-2" />
    </MessagePrimitive.Root>
  );
}

function AssistantText() {
  const hasToolCalls = useAuiState((s) =>
    s.message.parts.some((part) => part.type === "tool-call"),
  );

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
  const isRunning = useAuiState(
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
    <ChainOfThoughtPrimitive.Root className="mb-3 overflow-hidden rounded-lg border border-border/70 bg-muted/30">
      <div className="px-3 py-2">
        <ChainOfThoughtPrimitive.AccordionTrigger className="flex w-full items-center gap-2 text-left">
          <span
            className={cn(
              "inline-block size-2 rounded-full",
              isRunning ? "animate-pulse bg-primary" : "bg-muted-foreground",
            )}
          />
          <span
            className={cn(
              "font-medium text-sm",
              isRunning && "assistant-thinking-wave",
            )}
          >
            Thinking
          </span>
          <span className="ml-auto text-muted-foreground text-xs">
            {collapsed ? "Show" : "Hide"}
          </span>
        </ChainOfThoughtPrimitive.AccordionTrigger>
      </div>

      {collapsed ? (
        <p
          className={cn(
            "px-7 pb-3 text-muted-foreground text-sm",
            isRunning && "assistant-thinking-wave",
          )}
        >
          {summarizeThoughtPart(latestPart)}
        </p>
      ) : (
        <div className="px-3 pb-3">
          <div className="space-y-3 border-border/60 border-l pl-3">
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
    <div className="relative pl-3 before:absolute before:top-2 before:-left-4 before:size-2 before:rounded-full before:bg-border">
      {children}
    </div>
  );
}

function ThoughtReasoning({ text }: ReasoningMessagePartProps) {
  const isRunning = useAuiState(
    (s) => s.chainOfThought.status.type === "running",
  );
  const normalized = text.replace(/\s+/g, " ").trim();
  return (
    <p
      className={cn(
        "text-sm leading-6",
        isRunning && "assistant-thinking-wave",
      )}
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
    <div className="rounded-lg border border-border/70 bg-background/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "font-medium text-sm",
            status.type === "running" && "assistant-thinking-wave",
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
      className="col-start-3 row-start-2 -ml-1 flex gap-1 text-muted-foreground data-floating:absolute data-floating:rounded-md data-floating:border data-floating:bg-background data-floating:p-1 data-floating:shadow-sm"
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
