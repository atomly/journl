export type JournlIntent = "search" | "write" | "mixed";

const SEARCH_HINTS = [
  "find",
  "search",
  "show",
  "open",
  "go to",
  "navigate",
  "when did",
  "what did i write",
  "what does",
  "summarize my notes",
];

const WRITE_HINTS = [
  "edit",
  "format",
  "convert",
  "fix",
  "bold",
  "italic",
  "update",
  "append",
  "replace",
  "change",
  "restructure",
  "reorder",
  "move",
  "delete",
  "remove",
  "insert",
  "add",
  "write",
  "draft",
  "rewrite",
  "improve",
  "polish",
  "expand",
  "compose",
  "turn this into",
  "rephrase",
  "fix tone",
  "make this",
  "selected text",
  "highlighted",
  "this paragraph",
];

export function getLastUserMessage(messages: unknown): string {
  if (!Array.isArray(messages)) {
    return "";
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!message || typeof message !== "object") {
      continue;
    }

    const role = "role" in message ? message.role : undefined;
    if (role !== "user") {
      continue;
    }

    const content =
      "parts" in message && Array.isArray(message.parts)
        ? message.parts
        : "content" in message
          ? message.content
          : undefined;
    if (typeof content === "string") {
      return content;
    }

    if (!Array.isArray(content)) {
      continue;
    }

    const text = content
      .map((part) => {
        if (!part || typeof part !== "object") {
          return "";
        }

        if (!("type" in part)) {
          return "";
        }

        if (
          (part.type === "text" || part.type === "input_text") &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }

        return "";
      })
      .join(" ")
      .trim();

    if (text.length > 0) {
      return text;
    }
  }

  return "";
}

export function inferUserIntent(text: string): JournlIntent {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "mixed";
  }

  // Model routing is conservative: navigation/search words must not outweigh
  // an edit request and send mutations to the search-oriented model.
  const writes = WRITE_HINTS.some((hint) => normalized.includes(hint));
  const searches = SEARCH_HINTS.some((hint) => normalized.includes(hint));
  if (writes) return searches ? "mixed" : "write";
  return searches ? "search" : "mixed";
}
