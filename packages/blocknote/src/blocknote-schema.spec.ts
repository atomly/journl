import { schema } from "@acme/blocknote/schema";
import { describe, expect, test } from "vitest";
import { inventorySchema } from "./inventory/server-schema";

describe("shared content reference schema", () => {
  test("registers all custom specs and retains defaults", () => {
    expect(schema.inlineContentSchema).toHaveProperty("contentReference");
    expect(schema.blockSchema).toHaveProperty("referenceCard");
    expect(schema.blockSchema).toHaveProperty("contentEmbed");
    expect(schema.blockSchema).toHaveProperty("paragraph");
    expect(schema.inlineContentSchema).toHaveProperty("link");
  });

  test("keeps legacy inventory and installed frontend configs aligned", () => {
    expect(inventorySchema.blockSchema).toEqual(schema.blockSchema);
    expect(inventorySchema.inlineContentSchema).toEqual(
      schema.inlineContentSchema,
    );
  });
});
