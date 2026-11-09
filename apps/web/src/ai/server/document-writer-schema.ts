import { zBlockData, zTableCell, zTableContent } from "@acme/document";
import {
  OpenAISchemaCompatLayer,
  prepareJsonSchemaForOpenAIStrictMode,
  toStandardSchema,
  wrapSchemaWithNullTransform,
} from "@mastra/schema-compat";
import { type JSONSchema7, jsonSchema } from "ai";
import { z } from "zod/v4";
import {
  zAppendTableColumns,
  zAppendTableRows,
  zWriterOperation,
} from "./document-writer-operations";

export const writerOutputSchema = z.strictObject({
  operations: z.array(zWriterOperation),
});

// Generate one canonical representation per structure. Nested blocks use the
// existing insert.parentId operation, so the provider schema needs no recursion.
// Stored documents, metadata, references, and the operation contract stay intact.
const table = zTableContent.extend({
  rows: z.array(z.strictObject({ cells: z.array(zTableCell) })),
});
const variants = zBlockData.options.map((variant) => {
  if (variant.shape.type.value === "table")
    return variant.extend({ content: table.optional() });
  if (variant.shape.type.value === "codeBlock")
    return variant.extend({ content: z.string().optional() });
  return variant;
});
const [first, ...rest] = variants;
if (!first) throw new Error("The document schema requires block variants.");
const generatedData = z.discriminatedUnion("type", [first, ...rest]);
const generatedBlock = z.discriminatedUnion("type", [
  first.extend({ id: z.string().min(1) }),
  ...rest.map((variant) => variant.extend({ id: z.string().min(1) })),
]);
const predecessor = z
  .string()
  .min(1)
  .nullable()
  .describe(
    "An existing or earlier-inserted sibling under this operation's parentId. Never use a nested child as the predecessor of a root block. Track the last sibling separately for each parent. Null places the block first.",
  );
const described = z.strictObject({
  operations: z.array(
    z.discriminatedUnion("type", [
      z.strictObject({
        type: z.literal("insert"),
        parentId: z.string().min(1).nullable(),
        afterId: predecessor,
        block: generatedBlock,
      }),
      z.strictObject({
        type: z.literal("update"),
        id: z.string().min(1),
        data: generatedData,
      }),
      z.strictObject({ type: z.literal("remove"), id: z.string().min(1) }),
      z.strictObject({
        type: z.literal("move"),
        id: z.string().min(1),
        parentId: z.string().min(1).nullable(),
        afterId: predecessor,
      }),
      zAppendTableRows,
      zAppendTableColumns,
    ]),
  ),
});
const inputSchema = z.toJSONSchema(described, {
  io: "input",
  override: ({ zodSchema, jsonSchema }) => {
    // These disjoint tagged unions are equivalent as anyOf. Normalize before
    // native compatibility conversion so required unions do not become nullable.
    if (zodSchema instanceof z.ZodDiscriminatedUnion && jsonSchema.oneOf) {
      jsonSchema.anyOf = jsonSchema.oneOf;
      delete jsonSchema.oneOf;
    }
    if (!(zodSchema instanceof z.ZodObject) || !jsonSchema.properties) return;
    // Atom blocks explicitly forbid content. JSON has no undefined value.
    for (const [key, field] of Object.entries(zodSchema.shape)) {
      const schema = field instanceof z.ZodOptional ? field.unwrap() : field;
      if (schema instanceof z.ZodUndefined) delete jsonSchema.properties[key];
    }
  },
  reused: "inline",
  target: "draft-7",
  unrepresentable: "any",
}) as JSONSchema7;

// OpenAI requires optional properties to be present as null. Use Mastra's
// schema-aware decoder before domain validation, including for streamed prefixes.
const decoder = wrapSchemaWithNullTransform(
  toStandardSchema(
    jsonSchema<unknown>(inputSchema, {
      validate: async (value) => ({ success: true, value }),
    }),
  ),
);
export async function decodeWriterOutput(value: unknown) {
  const result = await decoder["~standard"].validate(value);
  if (result.issues)
    throw new Error("The writer schema could not decode its output.");
  return writerOutputSchema.parse(described.parse(result.value));
}
const providerSchema = new OpenAISchemaCompatLayer({
  modelId: "gpt-5-mini",
  provider: "openai.responses",
  supportsStructuredOutputs: true,
}).processToJSONSchema(jsonSchema(structuredClone(inputSchema)));
export const writerModelSchema = jsonSchema<z.infer<typeof writerOutputSchema>>(
  prepareJsonSchemaForOpenAIStrictMode(providerSchema),
  {
    validate: async (value) => {
      try {
        return { success: true, value: await decodeWriterOutput(value) };
      } catch (error) {
        return { error: error as Error, success: false };
      }
    },
  },
);
