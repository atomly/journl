import { expect, test } from "vitest";
import { describeExternal } from "./index";

test.each([
  ["https://github.com/atomly/journl", "repository", "atomly/journl"],
  ["https://github.com/atomly/journl/issues/1", "issue", "atomly/journl #1"],
  [
    "https://github.com/atomly/journl/pull/2",
    "pull-request",
    "atomly/journl #2",
  ],
])("classifies a supported GitHub resource: %s", (url, icon, compactLabel) => {
  expect(describeExternal(url)).toMatchObject({
    compactLabel,
    icon,
    provider: "github",
    sourceLabel: "GitHub",
  });
});
test("unknown platforms have useful path-specific fallbacks without custom renderer code", () => {
  expect(
    describeExternal("https://confluence.example.com/wiki/one?version=2"),
  ).toMatchObject({
    icon: "external",
    provider: "website",
    title: "confluence.example.com/wiki/one?version=2",
  });
  expect(
    describeExternal("https://github.com.evil.example/owner/repo")?.provider,
  ).toBe("website");
  expect(describeExternal("javascript:alert(1)")).toBeNull();
  expect(describeExternal("https://user:password@example.com")).toBeNull();
});
