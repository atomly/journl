// @vitest-environment jsdom
import { expect, test } from "vitest";
import { messageSegments } from "./message-parts";

test("research findings retain safe source links inside the activity accordion", () => {
  const segments = messageSegments([
    {
      input: { query: "news" },
      output: {
        findings: "Verified facts",
        sources: [
          { title: "Primary source", url: "https://example.com/source" },
          { title: "Unsafe", url: "javascript:alert(1)" },
        ],
      },
      state: "output-available",
      toolCallId: "research",
      type: "tool-webSearch",
    },
  ]);
  expect(segments).toHaveLength(1);
  expect(segments[0]).toMatchObject({
    kind: "activity",
    parts: [
      { type: "tool-webSearch" },
      {
        title: "Primary source",
        type: "source-url",
        url: "https://example.com/source",
      },
    ],
  });
  expect(JSON.stringify(segments)).not.toContain(
    '"type":"source-url","url":"javascript:',
  );
});
