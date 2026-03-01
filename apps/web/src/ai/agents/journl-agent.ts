import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { RequestContext } from "@mastra/core/request-context";
import { Memory } from "@mastra/memory";
import type { User } from "better-auth";
import { z } from "zod/v4";
import { miniModel, nanoModel } from "~/ai/providers/openai/text";
import { env } from "~/env";
import {
  journlMastraStore,
  journlMastraVector,
} from "../mastra/postgres-store";
import { model as embedder } from "../providers/openai/embedding";
import { applyEditorChanges } from "../tools/apply-editor-changes/tool";
import { createPage } from "../tools/create-page/tool";
import { zTargetEditor } from "../tools/manipulate-editor/schema";
import { manipulateEditor } from "../tools/manipulate-editor/tool";
import { navigateJournalEntry } from "../tools/navigate-journal-entry/tool";
import { navigatePage } from "../tools/navigate-page/tool";
import { rejectEditorChanges } from "../tools/reject-editor-changes/tool";
import { semanticJournalSearch } from "../tools/semantic-journal-search";
import { semanticPageSearch } from "../tools/semantic-page-search";
import { temporalJournalSearch } from "../tools/temporal-journal-search";
import { zJournlAgentReasoning } from "./journl-agent-reasoning";
import type { JournlAgentState } from "./journl-agent-state";

const JOURNL_AGENT_NAME = "Journl";
const JOURNL_AGENT_THREAD_PREFIX = "journl";
const JOURNL_MEMORY_LAST_MESSAGES = 30;
const JOURNL_REQUEST_CONTEXT_KEY = "journl_agent";
const JOURNL_SEMANTIC_SEARCH_RANGE = 2;
const JOURNL_SEMANTIC_SEARCH_SCOPE = "thread";
const JOURNL_SEMANTIC_TOP_K = 3;

const journlMemory = new Memory({
  embedder,
  options: {
    lastMessages: JOURNL_MEMORY_LAST_MESSAGES,
    semanticRecall: {
      messageRange: JOURNL_SEMANTIC_SEARCH_RANGE,
      scope: JOURNL_SEMANTIC_SEARCH_SCOPE,
      topK: JOURNL_SEMANTIC_TOP_K,
    },
  },
  storage: journlMastraStore,
  vector: journlMastraVector,
});

function prompt({ requestContext }: { requestContext?: RequestContext }) {
  const context = getJournlRequestContext(requestContext);
  if (!context) {
    throw new Error("Missing Journl context");
  }
  if (env.NODE_ENV === "development") {
    console.debug("[JournlAgentContext]", context);
  }
  return `# System Prompt

You are ${JOURNL_AGENT_NAME}, an AI companion that helps users write, navigate, and manage their own notes.

Current date: ${context.currentDate}
User's name: ${context.user.name}

Do not reproduce song lyrics or any other copyrighted material, even if asked.
${context.reasoning === "instant" ? "Before answering, quickly check whether a tool would improve accuracy (especially for recent, uncertain, or user-specific facts). If yes, use the tool instead of guessing." : ""}

## Environment

Here is useful information about the environment the user is in:

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
    ? `- ${context.activeEditors.length > 1 ? `There are ${context.activeEditors.length} active editors` : "There is one active editor"}: ${context.activeEditors.join(", ")}`
    : ""
}
${
  context.highlightedText.length > 0
    ? `- User has highlighted text: ${context.highlightedText.join(", ")}.`
    : ""
}

## Guidelines

- **Important**: If user refers to current editors ("today's note", "the page"), simply read the content of the active editor(s) for context. Don't ask for information you can already access.
- When referencing returned pages or journal entries, prefer markdown links using the tool-provided link field using this format for page and entries respectively: [Title](url) / [YYYY-MM-DD](url).
- Avoid exposing raw UUIDs in user-facing responses unless the user explicitly asks for the ID.
- For manipulateEditor, prefer the V2 intent contract: use intent.mode="replace" with full intent.content when you already know the exact body text to write; otherwise use intent.mode="transform" with a precise editorPrompt. For transform, only set scope="selection" when the user explicitly asked to edit selected text; otherwise rely on the default document scope.
- Call independent tools in parallel whenever possible.
- Complete tasks immediately. Take obvious next steps. Prefer direct tool actions over explanatory prose.
- Mirror user's tone but avoid corporate filler. Be concise and high-signal.
- Operate only on existing content; never fabricate. Prefer partial completion over clarifying questions when scope is large.
- For facts that are likely outside the user's notes (news, current events, live facts), use webSearch and cite sources.
- Prefer semantic/temporal journl tools for the user's personal content; use webSearch for public-web knowledge.
- When asked about what you can do, respond to the user in natural language.`;
}

const tools = {
  applyEditorChanges,
  createPage,
  manipulateEditor,
  navigateJournalEntry,
  navigatePage,
  rejectEditorChanges,
  semanticJournalSearch,
  semanticPageSearch,
  temporalJournalSearch,
  webSearch: openai.tools.webSearch(),
};

export const journlNano = new Agent({
  description: `${JOURNL_AGENT_NAME}, an AI companion for personal reflection, journaling, and knowledge discovery. Optimized for fast retrieval and navigation tasks.`,
  id: "journl-nano",
  instructions: prompt,
  memory: journlMemory,
  model: nanoModel,
  name: JOURNL_AGENT_NAME,
  tools,
});

export const journlMini = new Agent({
  description: `${JOURNL_AGENT_NAME}, an AI companion for personal reflection, journaling, and knowledge discovery.`,
  id: "journl-mini",
  instructions: prompt,
  memory: journlMemory,
  model: miniModel,
  name: JOURNL_AGENT_NAME,
  tools,
});

const zJournlAgentState: z.ZodType<JournlAgentState> = z.object({
  activeEditors: z.array(zTargetEditor),
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

export function setJournlRequestContext(context: JournlAgentState) {
  const requestContext = new RequestContext<{
    [JOURNL_REQUEST_CONTEXT_KEY]: JournlAgentState;
  }>();
  requestContext.set(
    JOURNL_REQUEST_CONTEXT_KEY,
    zJournlAgentState.parse(context),
  );
  return requestContext;
}

export function getJournlRequestContext(context?: RequestContext) {
  return context?.get<typeof JOURNL_REQUEST_CONTEXT_KEY, JournlAgentState>(
    JOURNL_REQUEST_CONTEXT_KEY,
  );
}

export function getJournlUserThread(user: User) {
  return `${JOURNL_AGENT_THREAD_PREFIX}:${user.id}`;
}
