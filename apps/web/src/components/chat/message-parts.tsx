// biome-ignore-all lint/suspicious/noArrayIndexKey: Streamed text parts and stateless code lines retain positional identity as content grows.
"use client";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@acme/ui/trace";
import {
  type DynamicToolUIPart,
  getToolName,
  isToolUIPart,
  type ToolUIPart,
  type UIMessage,
} from "ai";
import {
  ArrowUpRightIcon,
  BrainIcon,
  GlobeIcon,
  WrenchIcon,
} from "lucide-react";
import { Fragment } from "react";
import { zResearchFindings } from "~/ai/tools/research-schema";
import { safeChatLink } from "./links";
import { ChatMarkdown } from "./markdown";

type Part = UIMessage["parts"][number];
export function messageSegments(parts: Part[]) {
  const segments: (
    | { kind: "text"; text: string }
    | { kind: "activity"; parts: Part[] }
  )[] = [];
  const expanded = parts.flatMap((part): Part[] => {
    if (
      !isToolUIPart(part) ||
      getToolName(part) !== "webSearch" ||
      part.state !== "output-available"
    )
      return [part];
    const evidence = zResearchFindings.safeParse(part.output);
    if (!evidence.success) return [part];
    return [
      part,
      ...evidence.data.sources
        .filter((source) => safeChatLink(source.url))
        .map((source) => ({
          sourceId: `${part.toolCallId}:${source.url}`,
          title: source.title,
          type: "source-url" as const,
          url: source.url,
        })),
    ];
  });
  for (const part of expanded) {
    if (part.type === "text" && part.text.trim())
      segments.push({ kind: "text", text: part.text });
    else if (
      (part.type === "reasoning" && Boolean(part.text.trim())) ||
      part.type === "source-url" ||
      part.type === "source-document" ||
      isToolUIPart(part)
    ) {
      const previous = segments.at(-1);
      if (previous?.kind === "activity") previous.parts.push(part);
      else segments.push({ kind: "activity", parts: [part] });
    }
  }
  return segments;
}
const labels: Record<string, string> = {
  createPage: "Create page",
  navigateJournalEntry: "Open journal entry",
  navigatePage: "Open page",
  queryNoteReferences: "Explore references",
  semanticJournalSearch: "Search journal",
  semanticPageSearch: "Search pages",
  temporalJournalSearch: "Read journal entries",
  webSearch: "Search web",
  write: "Edit writing",
};
/** Empty assistant/step-start messages do not mean the model has answered. */
export function isMessageActivelyStreaming(message?: UIMessage) {
  if (message?.role !== "assistant") return false;
  return message.parts.some((part) =>
    part.type === "text" || part.type === "reasoning"
      ? part.state === "streaming" && Boolean(part.text.trim())
      : isToolUIPart(part) &&
        (part.state === "input-streaming" || part.state === "input-available"),
  );
}
function toolState(part: ToolUIPart | DynamicToolUIPart, active: boolean) {
  const incomplete =
    part.state === "input-streaming" || part.state === "input-available";
  const running = active && incomplete;
  const outputStatus =
    part.state === "output-available" &&
    typeof part.output === "object" &&
    part.output !== null &&
    "status" in part.output
      ? part.output.status
      : undefined;
  const cancelled = outputStatus === "cancelled";
  const conflicted = outputStatus === "conflict";
  const failed =
    part.state === "output-error" ||
    part.state === "output-denied" ||
    (!active && incomplete) ||
    outputStatus === "error" ||
    conflicted;
  return { cancelled, conflicted, failed, running };
}
function ActivityGroup({ parts, active }: { parts: Part[]; active: boolean }) {
  const tools = parts.filter(isToolUIPart);
  const states = tools.map((part) => toolState(part, active));
  const failed = states.some((state) => state.failed);
  const running =
    states.some((state) => state.running) ||
    parts.some(
      (part) =>
        part.type === "reasoning" && active && part.state === "streaming",
    );
  const cancelled = states.some((state) => state.cancelled);
  const conflicted = states.some((state) => state.conflicted);
  const sources = parts.filter(
    (part) =>
      part.type === "source-document" ||
      (part.type === "source-url" && safeChatLink(part.url)),
  ).length;
  const count = [
    tools.length
      ? `${tools.length} ${tools.length === 1 ? "action" : "actions"}`
      : "",
    sources ? `${sources} ${sources === 1 ? "source" : "sources"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>
        <TraceLine status={failed ? "error" : running ? "running" : undefined}>
          <TraceIcon>
            <WrenchIcon />
          </TraceIcon>
          <TraceTitle>Activity{count ? ` · ${count}` : ""}</TraceTitle>
          <TraceDescription>
            {conflicted
              ? "Conflict"
              : failed
                ? "Failed"
                : running
                  ? "Running"
                  : cancelled
                    ? "Cancelled"
                    : "Complete"}
          </TraceDescription>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <Trace>
          {parts.map((part, index) => (
            <Fragment key={index}>
              <Activity part={part} active={active} />
            </Fragment>
          ))}
        </Trace>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}
function Activity({ part, active }: { part: Part; active: boolean }) {
  if (part.type === "source-url") {
    const href = safeChatLink(part.url);
    if (!href) return null;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        <TraceLine>
          <TraceIcon>
            <GlobeIcon />
          </TraceIcon>
          <TraceTitle>
            {part.title || part.url}
            <span className="sr-only"> (opens in a new tab)</span>
          </TraceTitle>
          <TraceIcon>
            <ArrowUpRightIcon />
          </TraceIcon>
        </TraceLine>
      </a>
    );
  }
  if (part.type === "source-document")
    return (
      <TraceLine>
        <TraceIcon>
          <GlobeIcon />
        </TraceIcon>
        <TraceTitle>{part.title}</TraceTitle>
      </TraceLine>
    );
  if (part.type === "reasoning")
    return (
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine
            status={
              active && part.state === "streaming" ? "running" : undefined
            }
          >
            <TraceIcon>
              <BrainIcon />
            </TraceIcon>
            <TraceTitle>
              {active && part.state === "streaming" ? "Thinking" : "Thought"}
            </TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <ChatMarkdown text={part.text} />
        </TraceCollapsibleContent>
      </TraceCollapsible>
    );
  if (!isToolUIPart(part)) return null;
  const name = getToolName(part);
  const { cancelled, conflicted, failed, running } = toolState(part, active);
  const output = "output" in part ? part.output : undefined;
  const summary =
    output &&
    typeof output === "object" &&
    "message" in output &&
    typeof output.message === "string"
      ? output.message
      : Array.isArray(output)
        ? `${output.length} results`
        : undefined;
  const line = (
    <TraceLine status={failed ? "error" : running ? "running" : undefined}>
      <TraceIcon>
        <WrenchIcon />
      </TraceIcon>
      <TraceTitle>{labels[name] ?? "Assistant action"}</TraceTitle>
      <TraceDescription>
        {cancelled
          ? "Cancelled"
          : conflicted
            ? "Conflict"
            : failed
              ? "Failed"
              : running
                ? "Running"
                : "Complete"}
      </TraceDescription>
    </TraceLine>
  );
  if (!summary && !failed) return line;
  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        {summary ??
          (failed
            ? "This action could not complete. Please retry."
            : undefined)}
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}
export function ChatMessageParts({
  parts,
  active = false,
}: {
  parts: Part[];
  active?: boolean;
}) {
  return messageSegments(parts).map((segment, index) =>
    segment.kind === "text" ? (
      <ChatMarkdown key={index} text={segment.text} />
    ) : (
      <ActivityGroup key={index} parts={segment.parts} active={active} />
    ),
  );
}
