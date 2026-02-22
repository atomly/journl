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
  "entries",
  "entry",
  "pages",
  "page",
  "last week",
  "last month",
  "between",
  "summarize my notes",
];

const WRITE_HINTS = [
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

    const content = "content" in message ? message.content : undefined;
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

  let searchScore = 0;
  let writeScore = 0;

  for (const hint of SEARCH_HINTS) {
    if (normalized.includes(hint)) {
      searchScore += 2;
    }
  }

  for (const hint of WRITE_HINTS) {
    if (normalized.includes(hint)) {
      writeScore += 2;
    }
  }

  if (writeScore - searchScore >= 2) {
    return "write";
  }

  if (searchScore - writeScore >= 2) {
    return "search";
  }

  return "mixed";
}
