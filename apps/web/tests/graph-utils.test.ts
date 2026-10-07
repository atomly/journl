import { expect, test } from "vitest";
import {
  getExternalGraphTitle,
  getGraphDocumentTargetKey,
} from "../src/references/graph-utils";

test("graph labels distinguish separate GitHub issues and website pages", () => {
  expect(
    getExternalGraphTitle("https://github.com/atomly/journl/issues/291"),
  ).toBe("atomly/journl · Issue #291");
  expect(
    getExternalGraphTitle("https://github.com/atomly/journl/pull/302"),
  ).toBe("atomly/journl · PR #302");
  expect(getExternalGraphTitle("https://example.com/a?version=2")).toBe(
    "example.com/a?version=2",
  );
});

test("hiding block nodes retains the reference to their containing document", () => {
  const target = {
    blockId: "block",
    documentId: "note",
    kind: "document" as const,
  };
  expect(getGraphDocumentTargetKey(target, true)).toBe(
    "document:note#block:block",
  );
  expect(getGraphDocumentTargetKey(target, false)).toBe("document:note");
});
