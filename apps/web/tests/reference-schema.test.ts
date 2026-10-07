import { schema } from "@acme/blocknote/schema";
import { describe, expect, test } from "vitest";

describe("shared content reference schema", () => {
  test("registers all custom specs and retains defaults", () => {
    expect(schema.inlineContentSchema).toHaveProperty("contentReference");
    expect(schema.blockSchema).toHaveProperty("referenceCard");
    expect(schema.blockSchema).toHaveProperty("contentEmbed");
    expect(schema.blockSchema).toHaveProperty("paragraph");
    expect(schema.inlineContentSchema).toHaveProperty("link");
  });
});
