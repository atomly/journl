// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  readSidebarExpansion,
  useSidebarExpansion,
} from "./use-sidebar-expansion";

let root: Root;
let container: HTMLDivElement;
let current: ReturnType<typeof useSidebarExpansion>;
function Harness({
  owner = "alice",
  target = "/pages/a",
  ancestors = [],
}: {
  owner?: string;
  target?: string;
  ancestors?: string[];
}) {
  current = useSidebarExpansion(owner, target, ancestors);
  return null;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  vi.unstubAllGlobals();
});

test("manual opens survive remount; active ancestors beat saved collapse until manually collapsed for that target", async () => {
  await act(() => root.render(<Harness ancestors={["parent"]} />));
  expect(current.openFolders.parent).toBe(true);
  await act(() => current.setFolderOpen("parent", false));
  await act(() => root.render(<Harness ancestors={["parent"]} />));
  expect(current.openFolders.parent).toBe(false);
  await act(() =>
    root.render(<Harness target="/pages/b" ancestors={["parent"]} />),
  );
  expect(current.openFolders.parent).toBe(true);
  await act(() => root.render(<Harness ancestors={["parent"]} />));
  expect(current.openFolders.parent).toBe(true);
  await act(() => current.setFolderOpen("other", true));
  await act(() => root.unmount());
  root = createRoot(container);
  await act(() => root.render(<Harness />));
  expect(current.openFolders.other).toBe(true);
});

test("owner changes cannot carry manual choices or stored IDs across accounts", async () => {
  await act(() => root.render(<Harness />));
  await act(() => current.setFolderOpen("alice-folder", true));
  await act(() => root.render(<Harness owner="bob" />));
  expect(current.openFolders["alice-folder"]).toBeUndefined();
  await act(() => current.setFolderOpen("bob-folder", true));
  await act(() => root.render(<Harness owner="alice" />));
  expect(current.openFolders["alice-folder"]).toBe(true);
  expect(current.openFolders["bob-folder"]).toBeUndefined();
});

test("obsolete IDs expire and storage is bounded without fetching or validating the whole tree", () => {
  const now = Date.now();
  expect(readSidebarExpansion("invalid")).toEqual({});
  const saved = readSidebarExpansion(
    JSON.stringify({
      future: now + 1,
      invalid: true,
      old: 0,
      ...Object.fromEntries(
        Array.from({ length: 200 }, (_, i) => [`folder-${i}`, now - i]),
      ),
    }),
    now,
  );
  expect(Object.keys(saved)).toHaveLength(128);
  expect(saved.old).toBeUndefined();
  expect(saved.future).toBeUndefined();
});

test("disabled storage keeps manual expansion usable", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("disabled");
  });
  await act(() => root.render(<Harness />));
  await act(() => current.setFolderOpen("folder", true));
  expect(current.openFolders.folder).toBe(true);
  vi.restoreAllMocks();
});
