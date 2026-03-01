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
