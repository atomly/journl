import { applyDocumentOperations } from "@acme/document";
import { expect, test } from "vitest";
import { compileWriterOperations } from "./document-writer-operations";
import { decodeWriterOutput } from "./document-writer-schema";

test("strict streamed operations decode nullable options without losing table or inline metadata", async () => {
  const proposal = await decodeWriterOutput({
    operations: [
      {
        afterId: null,
        block: {
          content: "Parent",
          id: "parent",
          props: {
            backgroundColor: null,
            checked: true,
            textAlignment: null,
            textColor: null,
          },
          type: "checkListItem",
        },
        parentId: null,
        type: "insert",
      },
      {
        afterId: null,
        block: {
          content: "Child",
          id: "child",
          props: null,
          type: "checkListItem",
        },
        parentId: "parent",
        type: "insert",
      },
      {
        afterId: "parent",
        block: {
          content: {
            columnWidths: [200, null],
            headerCols: 0,
            headerRows: 1,
            rows: [
              {
                cells: [
                  {
                    content: [
                      {
                        styles: {
                          backgroundColor: null,
                          bold: true,
                          code: null,
                          italic: null,
                          strike: null,
                          textColor: null,
                          underline: null,
                        },
                        text: "Bold",
                        type: "text",
                      },
                    ],
                    props: {
                      backgroundColor: null,
                      colspan: 1,
                      rowspan: 1,
                      textAlignment: "center",
                      textColor: null,
                    },
                    type: "tableCell",
                  },
                  {
                    content: [
                      {
                        content: "Source",
                        href: "https://example.invalid/source",
                        type: "link",
                      },
                    ],
                    props: null,
                    type: "tableCell",
                  },
                ],
              },
            ],
            type: "tableContent",
          },
          id: "table",
          props: null,
          type: "table",
        },
        parentId: null,
        type: "insert",
      },
      {
        afterId: "table",
        block: {
          content: 'fn main() {\n    println!("Hello");\n}',
          id: "code",
          props: { language: "rust" },
          type: "codeBlock",
        },
        parentId: null,
        type: "insert",
      },
    ],
  });
  const doc = applyDocumentOperations(
    [],
    compileWriterOperations([], proposal.operations),
  );
  expect(doc[0]?.children?.[0]?.content).toBe("Child");
  expect(doc[1]).toMatchObject({
    content: {
      columnWidths: [200, undefined],
      headerCols: 0,
      headerRows: 1,
      rows: [
        {
          cells: [
            {
              content: [{ styles: { bold: true } }],
              props: { colspan: 1, rowspan: 1, textAlignment: "center" },
            },
            { content: [{ href: "https://example.invalid/source" }] },
          ],
        },
      ],
    },
  });
  expect(doc[2]?.content).toContain("\n");
});

test("wire validation retains useful issue paths and rejects forbidden atom content", async () => {
  await expect(
    decodeWriterOutput({
      operations: [
        {
          afterId: null,
          block: { content: "private", id: "image", type: "image" },
          parentId: null,
          type: "insert",
        },
      ],
    }),
  ).rejects.toMatchObject({
    issues: [
      expect.objectContaining({
        code: "invalid_type",
        path: ["operations", 0, "block", "content"],
      }),
    ],
  });
});

test("the provider grammar selects operation type first and cannot generate null operations", async () => {
  const { standardSchemaToJSONSchema, toStandardSchema } = await import(
    "@mastra/core/schema"
  );
  const { writerModelSchema } = await import("./document-writer-schema");
  const schema = standardSchemaToJSONSchema(
    toStandardSchema(writerModelSchema),
    { io: "input" },
  );
  const found: string[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const node = value as {
      properties?: Record<string, unknown>;
      const?: string;
      type?: string;
    };
    const type = node.properties?.type as { const?: string } | undefined;
    if (
      type?.const &&
      [
        "insert",
        "update",
        "remove",
        "move",
        "appendTableRows",
        "appendTableColumns",
      ].includes(type.const)
    ) {
      expect(Object.keys(node.properties ?? {})[0]).toBe("type");
      found.push(type.const);
    }
    Object.values(node).forEach(visit);
  };
  visit(schema);
  expect(found.sort()).toEqual([
    "appendTableColumns",
    "appendTableRows",
    "insert",
    "move",
    "remove",
    "update",
  ]);
  const items = (
    schema as {
      properties: { operations: { items: { anyOf: { type?: string }[] } } };
    }
  ).properties.operations.items;
  expect(items.anyOf.some((branch) => branch.type === "null")).toBe(false);
});
