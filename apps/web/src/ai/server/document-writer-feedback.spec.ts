import { expect, test } from "vitest";
import { z } from "zod/v4";
import { documentWriterFeedback } from "./document-writer-feedback";

test("feedback gives bounded schema locations and rules without field values", () => {
  const result = z
    .object({
      operations: z.array(
        z.object({ block: z.object({ content: z.undefined() }) }),
      ),
    })
    .safeParse({
      operations: Array.from({ length: 10 }, () => ({
        block: { content: "PRIVATE_TEXT" },
      })),
    });
  if (result.success) throw new Error("Expected invalid atom content");
  const feedback = documentWriterFeedback(result.error);
  expect(feedback).toContain(
    "operations[0].block.content: this field must be absent; omit it",
  );
  expect(feedback).not.toContain("PRIVATE_TEXT");
  expect(feedback?.split("\n")).toHaveLength(6);
  expect(feedback?.length).toBeLessThanOrEqual(1600);
});

test("only known proposal errors produce correction instructions", () => {
  expect(documentWriterFeedback(new SyntaxError("PRIVATE_JSON"))).toContain(
    "valid JSON",
  );
  expect(
    documentWriterFeedback(new Error("Block not found: PRIVATE_ID")),
  ).toContain("editable scope");
  expect(
    documentWriterFeedback(
      new Error(
        "Inserted block IDs must be unique and must not replace existing identities.",
      ),
    ),
  ).toContain("unique temporary insert labels");
  for (const message of [
    "Cancelled",
    "Forbidden",
    "Quota exceeded",
    "Document changed",
    "PRIVATE_PROVIDER_ERROR",
  ]) {
    expect(documentWriterFeedback(new Error(message))).toBeUndefined();
  }
});
