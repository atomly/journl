import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { RequestContext } from "@mastra/core/request-context";
import type { User } from "better-auth";
import {
  type JournlAgentContext,
  zJournlAgentContext,
} from "~/ai/mastra/agents/journl-agent-context";
import { miniModel, nanoModel } from "~/ai/providers/openai/text";
import { env } from "~/env";
import { applyEditorChanges } from "../../tools/apply-editor-changes/tool";
import { createPage } from "../../tools/create-page/tool";
import { manipulateEditor } from "../../tools/manipulate-editor/tool";
import { navigateJournalEntry } from "../../tools/navigate-journal-entry/tool";
import { navigatePage } from "../../tools/navigate-page/tool";
import { rejectEditorChanges } from "../../tools/reject-editor-changes/tool";
import { semanticJournalSearch } from "../../tools/semantic-journal-search";
import { semanticPageSearch } from "../../tools/semantic-page-search";
import { temporalJournalSearch } from "../../tools/temporal-journal-search";
import { journlMemory } from "../memory/memory";

const JOURNL_AGENT_NAME = "Journl";
const JOURNL_AGENT_THREAD_PREFIX = "journl";
const JOURNL_REQUEST_CONTEXT_KEY = "journl_agent";

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

<environment>
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
</environment>

## Guidelines

- **Important**: If user refers to current editors ("today's note", "the page"), simply read the content of the active editor(s) for context. Don't ask for information you can already access.
- When referencing returned pages or journal entries, prefer markdown links using the tool-provided link field using this format for page and entries respectively: [Title](url) / [YYYY-MM-DD](url).
- Avoid exposing raw UUIDs in user-facing responses unless the user explicitly asks for the ID.
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

export function setJournlRequestContext(context: JournlAgentContext) {
  const requestContext = new RequestContext<{
    [JOURNL_REQUEST_CONTEXT_KEY]: JournlAgentContext;
  }>();
  requestContext.set(
    JOURNL_REQUEST_CONTEXT_KEY,
    zJournlAgentContext.parse(context),
  );
  return requestContext;
}

export function getJournlRequestContext(context?: RequestContext) {
  return context?.get<typeof JOURNL_REQUEST_CONTEXT_KEY, JournlAgentContext>(
    JOURNL_REQUEST_CONTEXT_KEY,
  );
}

export function getJournlUserThread(user: User) {
  return `${JOURNL_AGENT_THREAD_PREFIX}:${user.id}`;
}
