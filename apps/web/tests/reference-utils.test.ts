import { describe, expect, test } from "vitest";
import {
  classifyInternalUrl,
  extractReferenceOccurrences,
  getTargetKey,
  normalizeExternalUrl,
} from "../src/references/reference-utils";

const appUrl = "https://journl.example";
const pageId = "36b06f18-6e7f-4b9e-9139-773f1f47baac";

describe("reference URL handling", () => {
  test("recognizes only exact trusted canonical routes and real dates", () => {
    expect(classifyInternalUrl(`/pages/${pageId}`, [], appUrl)).toEqual({
      entityId: pageId,
      kind: "page",
    });
    expect(
      classifyInternalUrl("https://evil-journl.example/pages/x", [], appUrl),
    ).toBeNull();
    expect(classifyInternalUrl("/journal/2025-02-30", [], appUrl)).toBeNull();
    expect(classifyInternalUrl("/journal/2024-02-29", [], appUrl)).toEqual({
      date: "2024-02-29",
      kind: "journal",
    });
    expect(
      classifyInternalUrl(
        `https://preview.example/pages/${pageId}`,
        ["https://preview.example"],
        appUrl,
      ),
    ).toEqual({ entityId: pageId, kind: "page" });
  });

  test("normalizes external identity without equating query or fragment variants", () => {
    expect(normalizeExternalUrl("https://EXAMPLE.com:443/a#one")).toBe(
      "https://example.com/a",
    );
    expect(
      getTargetKey({ kind: "external", url: "https://example.com/a#one" }),
    ).toBe(
      getTargetKey({ kind: "external", url: "https://example.com/a#two" }),
    );
    expect(
      getTargetKey({ kind: "external", url: "https://example.com/a?x=1" }),
    ).not.toBe(
      getTargetKey({ kind: "external", url: "https://example.com/a?x=2" }),
    );
    expect(normalizeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeExternalUrl("https://user:pass@example.com/")).toBeNull();
  });
});

test("extracts explicit references and nested links but skips code and target content", () => {
  const occurrences = extractReferenceOccurrences(
    {
      code: {
        content: [{ href: "https://ignored.example", type: "link" }],
        type: "codeBlock",
      },
      content: [
        {
          props: {
            blockId: "",
            documentId: pageId,
            label: "",
            targetKind: "document",
            url: `/pages/${pageId}`,
            version: 1,
          },
          type: "contentReference",
        },
        {
          content: [{ text: "Entry", type: "text" }],
          href: "/journal/2024-02-29",
          type: "link",
        },
      ],
      rows: [
        {
          cells: [[{ href: "https://github.com/atomly/journl", type: "link" }]],
        },
      ],
      targetContent: [
        {
          props: {
            blockId: "",
            documentId: pageId,
            label: "",
            targetKind: "document",
            url: "",
            version: 1,
          },
          type: "contentReference",
        },
      ],
    },
    { baseUrl: appUrl },
  );
  expect(occurrences).toHaveLength(3);
  expect(occurrences.map((item) => item.presentation)).toEqual([
    "badge",
    "link",
    "link",
  ]);
  expect(occurrences[1]?.route).toEqual({
    date: "2024-02-29",
    kind: "journal",
  });
  expect(occurrences[2]?.target).toEqual({
    kind: "external",
    url: "https://github.com/atomly/journl",
  });
});
