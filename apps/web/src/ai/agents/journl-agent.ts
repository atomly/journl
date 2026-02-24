import { Agent } from "@mastra/core/agent";
import { RequestContext } from "@mastra/core/request-context";
import { z } from "zod/v4";
import { miniModel, nanoModel } from "~/ai/providers/openai/text";
import { env } from "~/env";
import { createPage } from "../tools/create-page";
import { manipulateEditor } from "../tools/manipulate-editor";
import { navigateJournalEntry } from "../tools/navigate-journal-entry";
import { navigatePage } from "../tools/navigate-page";
import { semanticJournalSearch } from "../tools/semantic-journal-search";
import { semanticPageSearch } from "../tools/semantic-page-search";
import { temporalJournalSearch } from "../tools/temporal-journal-search";
import { zJournlAgentReasoning } from "./journl-agent-reasoning";
import type { JournlAgentState } from "./journl-agent-state";

const AGENT_NAME = "Journl";

function instructions({ requestContext }: { requestContext?: RequestContext }) {
  const context = getJournlRequestContext(requestContext);
  if (!context) {
    throw new Error("Missing Journl context");
  }
  if (env.NODE_ENV === "development") {
    console.debug("JournlAgentContext", context);
  }
  return `You are ${AGENT_NAME}, an AI companion that helps users write, navigate, and manage their own notes.

Current date: ${context.currentDate}
User's name: ${context.user.name}

Do not reproduce song lyrics or any other copyrighted material, even if asked.
${context.reasoning === "instant" ? "Before answering, quickly check whether a tool would improve accuracy (especially for recent, uncertain, or user-specific facts). If yes, use the tool instead of guessing." : ""}

# User State (deterministic, read-only)

${
  context.view.name === "journal"
    ? "- Currently at the journal timeline."
    : context.view.name === "journal-entry"
      ? `- Currently at the journal entry of date ${context.view.date}.`
      : context.view.name === "page"
        ? `- Currently at the page of UUID ${context.view.id} with the title ${context.view.title}.`
        : "- Currently at a different view without editors."
}
${
  context.activeEditors.length > 0
    ? `- ${context.activeEditors.length > 1 ? `There are ${context.activeEditors.length} active editors` : "There is one active editor"}: ${context.activeEditors
        .map((editor) =>
          editor.type === "journal-entry"
            ? `journal-entry:${editor.date}`
            : `page:${editor.id} (${editor.title})`,
        )
        .join(", ")}`
    : ""
}
${
  context.highlightedText.length > 0
    ? `- User has highlighted text: ${context.highlightedText.join(", ")}.`
    : ""
}

# Tools

Always try to call tools in parallel whenever possible.

## \`manipulateEditor\`

Modify the content of the target editor.

**Important**: The target editor has to be the ID of one of the active editors, if you don't know which to use, do not call this tool and ask the user to clarify instead.

- Treat the editor as an agent that will be manipulating the editor client-side.
- As such, the \`editorPrompt\` for the \`manipulateEditor\` tool must include as much detail as possible.
- Do not generate markdown, the editor will handle the formatting.
- Do not add titles to the pages because they are handled separately from the editor.
- **No fabrication**. Never invent prior notes, pages, links, or other content.

After a successful call to the \`manipulateEditor\` tool, avoid telling the user that the changes were made. At most, summarize the changes in a few words.

Use when:
- The user wants to write/add/insert/capture/log/note content.
- The user asks to format/structure existing text (headings, lists, checklists, quotes, code).
- The user asks to replace/transform the current selection/highlight.

Do not use when:
- The user only wants recall/analysis of prior content (use search tools instead).

## \`semanticJournalSearch\`

Semantic search over journal entries (daily notes). The user says or implies "find when I talked about X / patterns in Y / times I felt Z" or requests to search for a specific topic/theme/emotion.

## \`semanticPageSearch\`

Semantic search over pages. The user says or implies "find my notes on X / summarize/synthesize Y / pull my notes on Z across pages" or requests to search for a specific topic/theme/emotion.

## \`temporalJournalSearch\`

Searches for journal entries between two dates (for example: the user says or implies "show me last week/month/quarter entries", "show me entries between 2025-06-02 and 2025-06-08").

Can also be used to search for a single-day. When the user asks what a specific entry (for example: "today's/yesterday's entry", "october 1st's entry", "the note of 2025-06-02", or similar) says/reads, set the start date and end date to the same date.

Use when the user says or implies "show me last week/month/quarter", "what does <date> say" and compose with semantic searches when helpful.

## \`navigateJournalEntry\`

Open a specific journal entry by date. The user says or implies "open/go to today/yesterday/2025-06-02/last Monday" or requests to navigate to a specific date. Do not use when the target is a named page.

## \`navigatePage\`

Open a specific page by **UUID only**. The user says or implies "open/go to <page UUID>" or requests to navigate to a specific page. Do not use when the target is a journal entry.

If you don't know the UUID of the page, use the \`semanticPageSearch\` tool to find it before using this tool.

## \`createPage\`

Create a new page with the given title, infer the title from the user's prompt and clarify if it's not clear. Use when the user says or implies "create/new/add a page".

Do not navigate to the page after creating it, it will be done automatically.

---

# Global Behavior Meta

- **Important**: If user refers to current editors ("today's note", "the page"), simply read the content of the active editor(s) for context. Don't ask for information you can already access.
- When referencing returned pages or journal entries, prefer markdown links using the tool-provided link field using this format for page and entries respectively: [Title](url) / [YYYY-MM-DD](url).
- Avoid exposing raw UUIDs in user-facing responses unless the user explicitly asks for the ID.
- Complete tasks immediately. Take obvious next steps. Prefer direct tool actions over explanatory prose.
- Mirror user's tone but avoid corporate filler. Be concise and high-signal.
- Operate only on existing content; never fabricate. Prefer partial completion over clarifying questions when scope is large.`;
}

const tools = {
  createPage,
  manipulateEditor,
  navigateJournalEntry,
  navigatePage,
  semanticJournalSearch,
  semanticPageSearch,
  temporalJournalSearch,
};

export const journlMini = new Agent({
  description: `${AGENT_NAME}, an AI companion for personal reflection, journaling, and knowledge discovery.`,
  id: "journl-mini",
  instructions,
  model: miniModel,
  name: AGENT_NAME,
  tools,
});

export const journlNano = new Agent({
  description: `${AGENT_NAME}, an AI companion for personal reflection, journaling, and knowledge discovery. Optimized for fast retrieval and navigation tasks.`,
  id: "journl-nano",
  instructions,
  model: nanoModel,
  name: AGENT_NAME,
  tools,
});

const zJournlAgentState: z.ZodType<JournlAgentState> = z.object({
  activeEditors: z.array(
    z.union([
      z.object({
        date: z.string(),
        type: z.literal("journal-entry"),
      }),
      z.object({
        id: z.string(),
        title: z.string(),
        type: z.literal("page"),
      }),
    ]),
  ),
  currentDate: z.string(),
  highlightedText: z.array(z.string()),
  reasoning: zJournlAgentReasoning,
  user: z.object({
    name: z.string(),
  }),
  view: z.union([
    z.object({
      name: z.literal("journal"),
    }),
    z.object({
      date: z.string(),
      name: z.literal("journal-entry"),
    }),
    z.object({
      id: z.string(),
      name: z.literal("page"),
      title: z.string(),
    }),
    z.object({
      name: z.literal("other"),
    }),
  ]),
});

const REQUEST_CONTEXT_JOURNL_KEY = "journl_agent";

export function setJournlRequestContext(context: JournlAgentState) {
  const requestContext = new RequestContext<{
    [REQUEST_CONTEXT_JOURNL_KEY]: JournlAgentState;
  }>();
  requestContext.set(
    REQUEST_CONTEXT_JOURNL_KEY,
    zJournlAgentState.parse(context),
  );
  return requestContext;
}

export function getJournlRequestContext(context?: RequestContext) {
  return context?.get<typeof REQUEST_CONTEXT_JOURNL_KEY, JournlAgentState>(
    REQUEST_CONTEXT_JOURNL_KEY,
  );
}
