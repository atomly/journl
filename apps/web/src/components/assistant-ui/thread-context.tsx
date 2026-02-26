"use client";

import type { JournlReasoning } from "~/ai/agents/journl-agent-reasoning";
import { useJournlAgent } from "~/ai/agents/use-journl-agent";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const REASONING_MODES = ["instant", "thinking"] satisfies JournlReasoning[];
const COMPOSER_REASONING_SELECT_CONTENT_ID =
  "composer-reasoning-select-content";
const COMPOSER_REASONING_SELECT_TRIGGER_ID =
  "composer-reasoning-select-trigger";

const REASONING_MODE_LABELS = {
  instant: "Instant",
  thinking: "Thinking",
} as const;

export function ComposerReasoning() {
  const { getReasoning, setReasoning } = useJournlAgent();

  function handleReasoningModeChange(value: JournlReasoning) {
    setReasoning(value);
  }

  return (
    <Select value={getReasoning()} onValueChange={handleReasoningModeChange}>
      <SelectTrigger
        id={COMPOSER_REASONING_SELECT_TRIGGER_ID}
        aria-controls={COMPOSER_REASONING_SELECT_CONTENT_ID}
        size="sm"
        aria-label="Reasoning mode"
        className="h-8 w-22 border-primary/70 bg-background! px-2 text-foreground text-xs shadow-none hover:border-primary! focus-visible:ring-0 [&_svg]:text-foreground!"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent id={COMPOSER_REASONING_SELECT_CONTENT_ID}>
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
