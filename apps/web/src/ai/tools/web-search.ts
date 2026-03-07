import { openai } from "@ai-sdk/openai";
import type { ToolResultChunk } from "@mastra/core/stream";
import { getOpenAIWebSearchActionType } from "./common/openai-utils";

export const webSearch = openai.tools.webSearch();

export function isWebSearchCall({
  payload: { toolName, result },
}: ToolResultChunk) {
  return (
    toolName === "web_search" &&
    getOpenAIWebSearchActionType(result) === "search"
  );
}
