"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@acme/ui/select";
import { cn } from "@acme/ui/utils";
import {
  type ComponentProps,
  type ReactNode,
  useContext,
  useSyncExternalStore,
} from "react";
import type { JournlReasoning } from "~/ai/mastra/agents/journl-agent-reasoning";
import { useChatActions } from "~/components/chat/chat-presentation";
import { useJournlAgent } from "~/hooks/use-journl-agent";
import { ChatSurfaceContext } from "./chat-surface";

const REASONING_MODES = ["instant", "thinking"] satisfies JournlReasoning[];

const REASONING_MODE_LABELS = {
  instant: "Instant",
  thinking: "Thinking",
} as const;

type ComposerReasoningProps = {
  children: ReactNode;
};

export function ComposerReasoning({ children }: ComposerReasoningProps) {
  const { getReasoning, setReasoning, subscribe } = useJournlAgent();
  const reasoning = useSyncExternalStore(subscribe, getReasoning, getReasoning);
  const { exceeded } = useChatActions();
  function handleReasoningModeChange(value: JournlReasoning) {
    setReasoning(value);
  }

  return (
    <Select
      items={REASONING_MODE_LABELS}
      disabled={Boolean(exceeded)}
      value={reasoning}
      onValueChange={(value) => {
        if (value) handleReasoningModeChange(value);
      }}
    >
      {children}
    </Select>
  );
}

type ComposerReasoningTriggerProps = Omit<
  ComponentProps<typeof SelectTrigger>,
  "children"
>;

export function ComposerReasoningTrigger({
  className,
  size = "sm",
  "aria-label": ariaLabel = "Reasoning mode",
  ...props
}: ComposerReasoningTriggerProps) {
  return (
    <SelectTrigger
      size={size}
      aria-label={ariaLabel}
      className={cn(
        "h-8 w-22 border-primary/70 bg-background! px-2 text-foreground text-xs shadow-none hover:border-primary! focus-visible:ring-0 [&_svg]:text-foreground!",
        className,
      )}
      {...props}
    >
      <SelectValue />
    </SelectTrigger>
  );
}

type ComposerReasoningContentProps = Omit<
  ComponentProps<typeof SelectContent>,
  "children"
>;

export function ComposerReasoningContent(props: ComposerReasoningContentProps) {
  const container = useContext(ChatSurfaceContext);
  return (
    <SelectContent container={container ?? undefined} {...props}>
      <SelectGroup>
        {REASONING_MODES.map((reasoning) => (
          <SelectItem key={reasoning} value={reasoning}>
            {REASONING_MODE_LABELS[reasoning]}
          </SelectItem>
        ))}
      </SelectGroup>
    </SelectContent>
  );
}
