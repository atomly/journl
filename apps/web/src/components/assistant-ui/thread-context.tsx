"use client";

import type { ComponentProps, ReactNode } from "react";
import type { JournlReasoning } from "~/ai/agents/journl-agent-reasoning";
import { useJournlAgent } from "~/ai/agents/use-journl-agent";
import { cn } from "~/lib/cn";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const REASONING_MODES = ["instant", "thinking"] satisfies JournlReasoning[];

const REASONING_MODE_LABELS = {
  instant: "Instant",
  thinking: "Thinking",
} as const;

const COMPOSER_REASONING_TRIGGER_CLASSNAME =
  "h-8 w-22 border-primary/70 bg-background! px-2 text-foreground text-xs shadow-none hover:border-primary! focus-visible:ring-0 [&_svg]:text-foreground!";

type ComposerReasoningProps = {
  children: ReactNode;
};

export function ComposerReasoning({ children }: ComposerReasoningProps) {
  const { getReasoning, setReasoning } = useJournlAgent();

  function handleReasoningModeChange(value: string) {
    if (!REASONING_MODES.includes(value as JournlReasoning)) {
      return;
    }

    setReasoning(value as JournlReasoning);
  }

  return (
    <Select value={getReasoning()} onValueChange={handleReasoningModeChange}>
      {children}
    </Select>
  );
}

type ComposerReasoningTriggerProps = ComponentProps<typeof SelectTrigger>;

export function ComposerReasoningTrigger({
  className,
  children,
  size = "sm",
  "aria-label": ariaLabel = "Reasoning mode",
  ...props
}: ComposerReasoningTriggerProps) {
  return (
    <SelectTrigger
      size={size}
      aria-label={ariaLabel}
      className={cn(COMPOSER_REASONING_TRIGGER_CLASSNAME, className)}
      {...props}
    >
      {children ?? <SelectValue />}
    </SelectTrigger>
  );
}

type ComposerReasoningContentProps = ComponentProps<typeof SelectContent>;

export function ComposerReasoningContent({
  children,
  ...props
}: ComposerReasoningContentProps) {
  return (
    <SelectContent {...props}>
      {children ??
        REASONING_MODES.map((reasoning) => (
          <SelectItem key={reasoning} value={reasoning}>
            {REASONING_MODE_LABELS[reasoning]}
          </SelectItem>
        ))}
    </SelectContent>
  );
}

export function ComposerView() {
  const { getView } = useJournlAgent();

  const view = getView();

  const activeViewLabel =
    view.name === "journal-entry"
      ? `Entry: ${view.date}`
      : view.name === "journal"
        ? "Journal"
        : view.name === "page"
          ? `Page: ${view.title}`
          : null;

  if (!activeViewLabel) return null;

  return (
    <div className="min-w-0 max-w-36 rounded-md border border-primary/70 bg-background/80 px-3 py-1.5 text-foreground text-xs">
      <p className="truncate">{activeViewLabel}</p>
    </div>
  );
}
