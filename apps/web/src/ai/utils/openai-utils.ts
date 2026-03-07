import type { ToolResultChunk } from "@mastra/core/stream";

const OPENAI_CITATION_TOKEN_PATTERN = /\uE200cite\uE202[\s\S]*?\uE201/g;
const OPENAI_CITATION_MARKER_PATTERN = /[\uE200\uE201\uE202]/g;

/**
 * Returns the action type of an OpenAI web search result.
 *
 * @see {@link https://developers.openai.com/api/docs/guides/tools-web-search#output-and-citations | Web Search Output and Citations}
 */
export function getOpenAIWebSearchActionType(result: unknown) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const action = "action" in result ? result.action : undefined;

  if (!action || typeof action !== "object") {
    return null;
  }

  const type = "type" in action ? action.type : undefined;

  return typeof type === "string" ? type : null;
}

export function isOpenAIWebSearchCall({
  payload: { toolName, result },
}: ToolResultChunk) {
  return (
    (toolName === "web_search" || toolName === "webSearch") &&
    getOpenAIWebSearchActionType(result) === "search"
  );
}

export function stripOpenAICitationTokens(value: string) {
  return value
    .replace(OPENAI_CITATION_TOKEN_PATTERN, "")
    .replace(OPENAI_CITATION_MARKER_PATTERN, "");
}
