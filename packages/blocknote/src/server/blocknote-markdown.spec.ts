import type { EditorPartialBlock } from "@acme/blocknote/schema";
import { blocknoteMarkdown } from "@acme/blocknote/server";
import { describe, expect, test } from "vitest";

const blocks = [
  {
    content: [
      {
        props: {
          blockId: "",
          documentId: "36b06f18-6e7f-4b9e-9139-773f1f47baac",
          label: "Referenced page",
          resolutionToken: "",
          targetKind: "document",
          url: "/pages/36b06f18-6e7f-4b9e-9139-773f1f47baac",
          version: 1,
        },
        type: "contentReference",
      },
      { text: " and ", type: "text" },
      {
        props: {
          blockId: "",
          documentId: "",
          label: "GitHub issue",
          resolutionToken: "",
          targetKind: "external",
          url: "https://github.com/atomly/journl/issues/291",
          version: 1,
        },
        type: "contentReference",
      },
    ],
    type: "paragraph",
  },
  {
    props: {
      blockId: "",
      documentId: "36b06f18-6e7f-4b9e-9139-773f1f47baac",
      label: "Embedded page",
      resolutionToken: "",
      targetKind: "document",
      url: "/pages/36b06f18-6e7f-4b9e-9139-773f1f47baac",
      version: 1,
    },
    type: "contentEmbed",
  },
] as unknown as EditorPartialBlock[];

describe("reference Markdown export", () => {
  test("exports readable links for inline references and live embeds", async () => {
    const markdown = await blocknoteMarkdown(
      blocks as [EditorPartialBlock, ...EditorPartialBlock[]],
    );
    expect(markdown).toContain(
      "[Referenced page](/pages/36b06f18-6e7f-4b9e-9139-773f1f47baac)",
    );
    expect(markdown).toContain(
      "[GitHub issue](https://github.com/atomly/journl/issues/291)",
    );
    expect(markdown).toContain(
      "[Embedded page](/pages/36b06f18-6e7f-4b9e-9139-773f1f47baac)",
    );
  });
});
