import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
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
import type { ComponentProps } from "react";
import { MarkdownText } from "~/components/ai/markdown-text";
import { TooltipIconButton } from "~/components/ai/tooltip-icon-button";
import { Button } from "~/components/ui/button";
import { cn } from "~/components/utils";

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
          "-top-12 !size-10 !bg-background absolute rounded-full disabled:invisible",
          className,
        )}
        {...props}
      >
        <ArrowDownIcon className="size-6" />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
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
            className="my-2.5 size-8 p-2 transition-opacity ease-in"
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
            className="my-2.5 size-8 p-2 transition-opacity ease-in"
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
    <MessagePrimitive.Root className="grid w-full max-w-[var(--thread-max-width)] auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 py-4 [&:where(>*)]:col-start-2">
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

      <div className="col-start-2 row-start-2 max-w-[calc(var(--thread-max-width)*0.8)] break-words rounded-3xl bg-muted px-5 py-2.5 text-foreground">
        <MessagePrimitive.Content />
      </div>

      <BranchPicker className="-mr-1 col-span-full col-start-1 row-start-3 justify-end" />
    </MessagePrimitive.Root>
  );
}

export function EditComposer() {
  return (
    <ComposerPrimitive.Root className="my-4 flex w-full max-w-[var(--thread-max-width)] flex-col gap-2 rounded-xl bg-muted">
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
    <MessagePrimitive.Root className="relative grid w-full max-w-[var(--thread-max-width)] grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr] py-4">
      <div className="col-span-2 col-start-2 row-start-1 my-1.5 max-w-[calc(var(--thread-max-width)*0.8)] break-words text-foreground leading-7">
        <MessagePrimitive.Content components={{ Text: MarkdownText }} />
        <MessagePrimitive.Error>
          <ErrorPrimitive.Root className="mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-200">
            <ErrorPrimitive.Message className="line-clamp-2" />
          </ErrorPrimitive.Root>
        </MessagePrimitive.Error>
      </div>

      <AssistantActionBar />

      <BranchPicker className="-ml-2 col-start-2 row-start-2 mr-2" />
    </MessagePrimitive.Root>
  );
}

function AssistantActionBar() {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="-ml-1 col-start-3 row-start-2 flex gap-1 text-muted-foreground data-[floating]:absolute data-[floating]:rounded-md data-[floating]:border data-[floating]:bg-background data-[floating]:p-1 data-[floating]:shadow-sm"
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
