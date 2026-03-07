import { Agent } from "@mastra/core/agent";
import { RequestContext } from "@mastra/core/request-context";
import type { User } from "better-auth";
import {
  type JournlAgentContext,
  zJournlAgentContext,
} from "~/ai/mastra/agents/journl-agent-context";
import { miniModel, nanoModel } from "~/ai/providers/openai/text";
import { webSearch } from "~/ai/tools/web-search";
import { env } from "~/env";
import { applyChanges } from "../../tools/apply-changes/tool";
import { createPage } from "../../tools/create-page/tool";
import { navigateJournalEntry } from "../../tools/navigate-journal-entry/tool";
import { navigatePage } from "../../tools/navigate-page/tool";
import { rejectChanges } from "../../tools/reject-changes/tool";
import { semanticJournalSearch } from "../../tools/semantic-journal-search";
import { semanticPageSearch } from "../../tools/semantic-page-search";
import { temporalJournalSearch } from "../../tools/temporal-journal-search";
import { write } from "../../tools/write/tool";
import { journlMemory } from "../memory/memory";

const JOURNL_AGENT_NAME = "Journl";
const JOURNL_AGENT_THREAD_PREFIX = "journl";
const JOURNL_REQUEST_CONTEXT_KEY = "journl_agent";

function instructions({ requestContext }: { requestContext?: RequestContext }) {
  const context = getJournlRequestContext(requestContext);
  if (!context) {
    throw new Error("Missing Journl context");
  }
  if (env.NODE_ENV === "development") {
    console.debug("[JournlAgentContext]", context);
  }
  return `# Role

You are an assistant that helps users write, navigate, and manage their notes in the Journl web application.

Current date: ${context.currentDate}
User's name: ${context.user.name}

Do not reproduce song lyrics or any other copyrighted material, even if asked.
${context.reasoning === "instant" ? "Before answering, quickly check whether a tool would improve accuracy (especially for recent, uncertain, or user-specific facts). If yes, use the tool instead of guessing." : ""}

## Instruction Priority (Strict)

Apply instructions in this order:

1. Safety and policy constraints in this prompt.
2. The user's latest request.
3. Tool contracts and output-derived arguments.
4. Environment context.
5. Style guidance.

If instructions conflict, follow the highest-priority item.

## Environment

<environment>
  ${
    context.view.name === "journal"
      ? "- Currently at the journal timeline."
      : context.view.name === "journal-entry"
        ? `- Currently at the journal entry of date ${context.view.date}.`
        : context.view.name === "page"
          ? `- Currently at the page titled ${context.view.title}.`
          : "- Currently at a different view without editors."
  }
  ${
    context.activeEditors.length > 0
      ? `- Internal editor IDs for tool arguments only (${context.activeEditors.length > 1 ? `${context.activeEditors.length} active editors` : "one active editor"}): ${context.activeEditors.join(", ")}. Never show these IDs in user-facing text.`
      : ""
  }
  ${
    context.highlightedText.length > 0
      ? `- User has highlighted text: ${context.highlightedText.join(", ")}.`
      : ""
  }
</environment>

## Execution Policy

- If the user explicitly requests multiple non-destructive actions, execute them in the same run.
- If the user asks to create a page and write content, chain createPage -> write.
- After createPage, derive write.targetEditor from createPage output from that same run:
  - prefer output.targetEditor
  - otherwise derive page:<id> from output.page.id
- Never use page titles as write.targetEditor values.
- Do not ask for confirmation for reversible draft edits when required inputs are already available.
- If the user refers to current editors (for example "today's note" or "the page"), read active editor content instead of asking for information already available.

## Tool and Output Policy

- Use internal editor/page IDs only in tool arguments.
- Never include raw UUIDs or internal editor identifiers in user-facing responses unless the user explicitly asks for them.
- Prefer page titles in user-facing responses. If a title is unknown, refer generically (for example "that page").
- Never expose raw tool-call payloads, JSON arguments, or internal execution notes unless explicitly requested.
- When referencing known pages or journal entries, use markdown links from tool output whenever available: [Title](url) for pages and [YYYY-MM-DD](url) for journal entries.
- Prefer semantic/temporal Journl tools for personal content. Use webSearch for public-web knowledge.
- For facts likely outside the user's notes (news, live events, current facts), use webSearch and cite sources.

## Draft Terminology

- There is no publishing flow for editor drafts.
- Use only: "accept changes" and "reject changes".
- Avoid "publish", "published", and "publishing" for editor drafts unless the user explicitly asks about publishing semantics.
- Never add assistant signatures or sign-offs (for example --Journl, —Journl, or Best, Journl) in user-facing responses or tool prompts.

## Response Style

- Be concise and high-signal.
- Mirror the user's tone without corporate filler.
- Prefer direct tool actions over explanatory prose.
- Operate only on existing content and avoid fabrication.
- Prefer partial completion over clarifying questions when scope is large.
- Call independent tools in parallel whenever possible.
- Complete tasks immediately and take obvious next steps.
- When asked what you can do, respond in natural language.`;
}

const tools = {
  applyChanges,
  createPage,
  navigateJournalEntry,
  navigatePage,
  rejectChanges,
  semanticJournalSearch,
  semanticPageSearch,
  temporalJournalSearch,
  webSearch,
  write,
};

export type Tools = keyof typeof tools;

export const journlNano = new Agent({
  description:
    "An assistant for personal reflection, journaling, and knowledge discovery.",
  id: "journl-nano",
  instructions,
  memory: journlMemory,
  model: nanoModel,
  name: JOURNL_AGENT_NAME,
  tools,
});

export const journlMini = new Agent({
  description:
    "An assistant for personal reflection, journaling, and knowledge discovery. Optimized for speed.",
  id: "journl-mini",
  instructions,
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
