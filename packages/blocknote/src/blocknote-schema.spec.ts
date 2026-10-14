import { schema } from "@acme/blocknote/schema";
import { serverSchema } from "@acme/blocknote/server";
import { describe, expect, test } from "vitest";

describe("shared content reference schema", () => {
  test("registers all custom specs and retains defaults", () => {
    expect(schema.inlineContentSchema).toHaveProperty("contentReference");
    expect(schema.blockSchema).toHaveProperty("referenceCard");
    expect(schema.blockSchema).toHaveProperty("contentEmbed");
    expect(schema.blockSchema).toHaveProperty("paragraph");
    expect(schema.inlineContentSchema).toHaveProperty("link");
  });

  test("keeps persisted block and inline configs identical on server and client", () => {
    expect(serverSchema.blockSchema).toEqual(schema.blockSchema);
    expect(serverSchema.inlineContentSchema).toEqual(
      schema.inlineContentSchema,
    );
  });
});
