"use client";

import type { JournlReasoning } from "~/ai/agents/journl-agent-reasoning";
import { useJournlAgent } from "~/ai/agents/use-journl-agent";
import { useThreadChatError } from "~/components/assistant-ui/thread-runtime";
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

type ComposerReasoningProps = {
  idPrefix?: string;
};

export function ComposerReasoning({
  idPrefix = "composer-reasoning",
}: ComposerReasoningProps) {
  const { getReasoning, setReasoning } = useJournlAgent();
  const { usageQuotaExceeded } = useThreadChatError();
  const selectContentId = `${idPrefix}-select-content`;

  function handleReasoningModeChange(value: JournlReasoning) {
    setReasoning(value);
  }

  return (
    <Select
      disabled={Boolean(usageQuotaExceeded)}
      value={getReasoning()}
      onValueChange={handleReasoningModeChange}
    >
      <SelectTrigger
        size="sm"
        aria-label="Reasoning mode"
        aria-controls={selectContentId}
        className="h-8 w-22 border-primary/70 bg-background! px-2 text-foreground text-xs shadow-none hover:border-primary! focus-visible:ring-0 [&_svg]:text-foreground!"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent id={selectContentId}>
        {REASONING_MODES.map((reasoning) => (
          <SelectItem key={reasoning} value={reasoning}>
            {REASONING_MODE_LABELS[reasoning]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
