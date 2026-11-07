import { z } from "zod/v4";

/** Return bounded schema/rule feedback, never document values or provider payloads. */
export function documentWriterFeedback(error: unknown): string | undefined {
  if (error instanceof SyntaxError)
    return "Return valid JSON matching the supplied operation schema.";
  if (error instanceof z.ZodError) {
    return error.issues
      .slice(0, 6)
      .map((issue) => {
        const path =
          issue.path
            .map((part, index) =>
              typeof part === "number"
                ? `[${part}]`
                : `${index ? "." : ""}${/^[A-Za-z_-]{1,64}$/.test(String(part)) ? String(part) : "?"}`,
            )
            .join("") || "operations";
        if (issue.code === "invalid_type")
          return `${path}: ${issue.expected === "undefined" ? "this field must be absent; omit it" : `expected ${issue.expected}`}.`;
        if (issue.code === "unrecognized_keys")
          return `${path}: remove properties not declared in the schema.`;
        return `${path}: ${issue.code}; follow this field's schema constraints.`;
      })
      .join("\n")
      .slice(0, 1600);
  }
  if (!(error instanceof Error)) return;
  if (error.message.startsWith("Block not found:"))
    return "An operation references a block outside the current editable scope, or one already removed. Use existing IDs or earlier inserts that remain available.";
  const rules = new Map([
    [
      "Cannot move a block into itself",
      "A move must not place a block inside itself or any of its descendants.",
    ],
    [
      "Cannot position a block after itself",
      "A move cannot use its own ID as afterId.",
    ],
    [
      "Predecessor is not in the destination sibling group",
      "afterId must identify an available sibling in the destination parent. Use null for the first sibling.",
    ],
    ["Duplicate block ID", "All inserted block and child IDs must be unique."],
    [
      "Inserted block IDs must be unique and must not replace existing identities.",
      "Use unique temporary insert labels, never an existing block ID. Use update for existing blocks.",
    ],
    [
      "Nesting exceeds document limit",
      "Reduce nesting; the document nesting limit is 128.",
    ],
  ]);
  return rules.get(error.message);
}
