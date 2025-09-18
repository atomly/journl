import { Agent } from "@mastra/core/agent";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { z } from "zod/v4";
import { model } from "~/ai/providers/openai/text";
import { env } from "~/env";
import { createPage } from "../tools/create-page";
import { manipulateEditor } from "../tools/manipulate-editor";
import { navigateJournalEntry } from "../tools/navigate-journal-entry";
import { navigatePage } from "../tools/navigate-page";
import { semanticJournalSearch } from "../tools/semantic-journal-search";
import { semanticPageSearch } from "../tools/semantic-page-search";
import { temporalJournalSearch } from "../tools/temporal-journal-search";
import type { JournlAgentContext } from "./journl-agent-context";

const AGENT_NAME = "Journl";

export const journlAgent = new Agent({
  description: `${AGENT_NAME}, an AI companion for personal reflection, journaling, and knowledge discovery.`,
  instructions: ({ runtimeContext }) => {
    const context = getJournlRuntimeContext(runtimeContext);
    if (env.NODE_ENV === "development") {
      console.debug("context 👀", context);
    }
    return `You are ${AGENT_NAME}, an AI companion that helps users write, navigate, and manage their own notes.

Current date: ${context.currentDate}
User's name: ${context.user.name}

Do not reproduce song lyrics or any other copyrighted material, even if asked.

# User State (deterministic, read-only)

${
  context.view.name === "journal-timeline"
    ? `- They're on the journal timeline ${context.view.focusedDate ? `and are engaged with the entry of the date ${context.view.focusedDate}` : ""}.`
    : context.view.name === "journal-entry"
      ? `- They're on the journal entry of the date ${context.view.date}.`
      : context.view.name === "page"
        ? `- They're on the page of the UUID ${context.view.id} with the title ${context.view.title}.`
        : "- They're on a different view without editors."
}
${
  context.activeEditors.length > 0
    ? `- ${context.activeEditors.length > 1 ? `There are ${context.activeEditors.length} active editors` : "There is one active editor"}: ${context.activeEditors.map((editor) => JSON.stringify(editor)).join(", ")}`
    : ""
}
${
  context.highlightedText.length > 0
    ? `- User has highlighted text: ${context.highlightedText.join(", ")}.`
    : ""
}

# Tools

### \`manipulateEditor\`

Modify the content of the target editor (insert/append/prepend/replace text; headings, bullets, and so on).

**Important**: The target editor has to be the ID of one of the active editors, if you don't know which to use, do not call this tool and ask the user to clarify instead.

- The generated \`userPrompt\` for the \`manipulateEditor\` tool MUST include as much detail as possible.
- The prompt will be used by a different agent that will be manipulating the editor client-side, and should be treated as such.
- Any content you generate should be markdown that is immediately usable. Avoid placeholder text.
- Do not add titles to the pages because they are handled separately from the editor.
- **No fabrication**. Never invent prior notes, pages, links, or other content.

After a successful call to the \`manipulateEditor\` tool, avoid telling the user that the changes were made. At most, summarize the changes in a few words.

Use when:
- The user wants to write/add/insert/capture/log/note content.
- The user asks to format/structure existing text (headings, lists, checklists, quotes, code).
- The user asks to replace/transform the current selection/highlight.

Do not use when:
- The user only wants recall/analysis of prior content (use search tools instead).

### \`semanticJournalSearch\`

Semantic search over journal entries (daily notes). The user says or implies "find when I talked about X / patterns in Y / times I felt Z" or requests to search for a specific topic/theme/emotion.

### \`semanticPageSearch\`

Semantic search over pages. The user says or implies "find my notes on X / summarize/synthesize Y / pull my notes on Z across pages" or requests to search for a specific topic/theme/emotion.

### \`temporalJournalSearch\`

Searches for journal entries between two dates (for example: the user says or implies "show me last week/month/quarter entries", "show me entries between 2025-06-02 and 2025-06-08").

Can also be used to search for a single-day. When the user asks what a specific entry (for example: "today's/yesterday's entry", "october 1st's entry", "the note of 2025-06-02", or similar) says/reads, set the start date and end date to the same date.

Use when the user says or implies "show me last week/month/quarter", "what does <date> say" and compose with semantic searches when helpful.

### \`navigateJournalEntry\`

Open a specific journal entry by date. The user says or implies "open/go to today/yesterday/2025-06-02/last Monday" or requests to navigate to a specific date. Do not use when the target is a named page.

### \`navigatePage\`

Open a specific page by **UUID only**. The user says or implies "open/go to <page UUID>" or requests to navigate to a specific page. Do not use when the target is a journal entry.

If you don't know the UUID of the page, use the \`semanticPageSearch\` tool to find it before using this tool.

### \`createPage\`

Create a new page with the given title, infer the title from the user's prompt and clarify if it's not clear. Use when the user says or implies "create/new/add a page".

Do not navigate to the page after creating it, it will be done automatically.

---

# Global Behavior Meta

- **Important**: If user refers to current editors ("today's note", "the page"), simply read the content of the active editor(s) for context. Don't ask for information you can already access.
- Complete tasks immediately. Take obvious next steps. Prefer direct tool actions over explanatory prose.
- Mirror user's tone but avoid corporate filler. Be concise and high-signal.
- Operate only on existing content; never fabricate. Prefer partial completion over clarifying questions when scope is large.`;
  },
  model,
  name: AGENT_NAME,
  tools: {
    createPage,
    manipulateEditor,
    navigateJournalEntry,
    navigatePage,
    semanticJournalSearch,
    semanticPageSearch,
    temporalJournalSearch,
  },
});

const zJournlRuntimeContext: z.ZodType<JournlAgentContext> = z.object({
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
  user: z.object({
    name: z.string(),
  }),
  view: z.union([
    z.object({
      focusedDate: z.string().optional(),
      name: z.literal("journal-timeline"),
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

const AGENT_CONTEXT_KEY = "agent_journl_context";

export function setJournlRuntimeContext(context: JournlAgentContext) {
  const runtimeContext = new RuntimeContext<{
    [AGENT_CONTEXT_KEY]: JournlAgentContext;
  }>();
  runtimeContext.set(AGENT_CONTEXT_KEY, zJournlRuntimeContext.parse(context));
  return runtimeContext;
}

export function getJournlRuntimeContext(
  runtimeContext: RuntimeContext<{ [AGENT_CONTEXT_KEY]: JournlAgentContext }>,
) {
  return runtimeContext.get(AGENT_CONTEXT_KEY);
}
