import { DocumentOperationError } from "@acme/document";
import { z } from "zod/v4";

/** Return bounded schema/rule feedback, never document values or provider payloads. */
export function documentWriterFeedback(error: unknown): string | undefined {
  if (error instanceof DocumentOperationError) {
    const feedback = documentWriterFeedback(error.cause);
    return feedback
      ? `operations[${error.index}] (${error.operation}): ${feedback}`
      : undefined;
  }
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
        if (issue.code === "unrecognized_keys") {
          // These are fixed contract field names, never arbitrary model keys.
          const fields = issue.keys.filter((key) =>
            ["id", "children", "parentId", "afterId", "block", "data"].includes(
              key,
            ),
          );
          const detail = fields.length
            ? `remove these undeclared fields: ${fields.join(", ")}.`
            : "remove properties not declared in the schema.";
          const update =
            issue.path.at(-1) === "data"
              ? " Updates accept only type, props, and content. Change hierarchy with move, insert, or remove operations."
              : "";
          return `${path}: ${detail}${update}`;
        }
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
  // These fixed rules contain no model-generated values.
  for (const rule of [
    "Table additions require an existing table with content.",
    "New tables must start with one row. Append each later row with its own operation.",
    "Table row spans exceed the existing rows.",
    "Table cells overlap.",
    "Table additions require a rectangular table.",
    "Table additions require a nonempty table.",
    "Table widths exceed the existing columns. Use a table update to repair the layout.",
    "New table cells must not be merged. Use a table update for merged additions.",
    "Table additions require new rows or columns.",
    "New rows must contain one cell per existing table column.",
    "New columns must contain one cell per existing table row, including headers.",
    "Inline edits must preserve block identity, type, and props, and cannot add blocks or children. Change inline content only.",
  ]) {
    if (error.message === rule) return rule;
  }
  return rules.get(error.message);
}
