import { getToolName, isToolUIPart, type UIMessage } from "ai";

export const WRITING_CONTEXT_MESSAGES = 12;
export const WRITING_CONTEXT_CHARACTERS = 32_000;
const readingTools = new Set([
  "semanticJournalSearch",
  "semanticPageSearch",
  "temporalJournalSearch",
  "queryNoteReferences",
  "webSearch",
]);

/** Use actual conversation text to resolve references, never model-authored tool arguments. */
export function getWritingContext(messages: readonly UIMessage[]) {
  let current = messages.length - 1;
  while (current >= 0 && messages[current]?.role !== "user") current--;
  let remaining = WRITING_CONTEXT_CHARACTERS;
  const context: { role: "user" | "assistant"; content: string }[] = [];
  for (let index = messages.length - 1; index >= 0 && remaining > 0; index--) {
    const message = messages[index];
    if (!message || (message.role !== "user" && message.role !== "assistant"))
      continue;
    let available = remaining;
    const retain = (text: string, whole = false): string[] => {
      if (available <= 0 || (whole && text.length > available)) return [];
      const value = text.slice(-available);
      available -= value.length + 1;
      return [value];
    };
    const content = [...message.parts]
      .reverse()
      .flatMap((part) => {
        if (index < current && part.type === "text") return retain(part.text);
        if (part.type === "source-url")
          return retain(`Source: ${part.title ?? ""} ${part.url}`);
        if (
          isToolUIPart(part) &&
          part.state === "output-available" &&
          readingTools.has(getToolName(part))
        )
          return retain(
            JSON.stringify({ result: part.output, tool: getToolName(part) }),
            true,
          );
        return [];
      })
      .reverse()
      .join("\n")
      .trim();
    if (!content) continue;
    context.unshift({ content, role: message.role });
    remaining -= content.length;
    if (context.length === WRITING_CONTEXT_MESSAGES) break;
  }
  return context;
}
