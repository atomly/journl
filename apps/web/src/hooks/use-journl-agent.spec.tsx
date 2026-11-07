// @vitest-environment jsdom
import { createDocumentEditor } from "@acme/better-editor/engine/editor";
import type { Editor } from "@tiptap/core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { JournlAgentProvider, useJournlAgent } from "./use-journl-agent";

const route = vi.hoisted(() => ({ pathname: "/pages/first" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
let current: ReturnType<typeof useJournlAgent>;
let root: Root;
const editors: Editor[] = [];
function Harness() {
  current = useJournlAgent();
  return null;
}
async function render(pathname = route.pathname) {
  route.pathname = pathname;
  await act(async () =>
    root.render(
      <JournlAgentProvider>
        <Harness />
      </JournlAgentProvider>,
    ),
  );
}
function editor() {
  const instance = createDocumentEditor({
    element: document.createElement("div"),
    extensions: [],
    initialBlocks: [{ content: "Original", id: "block", type: "paragraph" }],
    resolveUrl: async () => ({ items: [] }),
  });
  editors.push(instance);
  return instance;
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  route.pathname = "/pages/first";
  root = createRoot(document.createElement("div"));
  await render();
});
afterEach(async () => {
  for (const value of editors.splice(0)) value.destroy();
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

test("the actual route selects an unfocused page even before metadata or after stale effect cleanup", () => {
  current.registerEditor("page:first", editor());
  current.setView({ id: "old", name: "page", title: "Old page" });
  expect([...current.getEditors().keys()]).toEqual(["page:first"]);
  current.setView({ name: "other" });
  expect([...current.getEditors().keys()]).toEqual(["page:first"]);
  expect(current.getView()).toMatchObject({ id: "first", name: "page" });
  expect(current.prepareEdits()).toBe(true);
  expect(current.getEditTarget()?.id).toBe("page:first");
});

test("manual navigation cancels a prepared target and cannot silently retarget that request", async () => {
  const first = current.registerEditor("page:first", editor());
  current.registerEditor("page:second", editor());
  current.prepareEdits();
  const captured = current.getEditTarget();
  await render("/pages/second");
  expect(first.session.getSnapshot().status).toBe("cancelled");
  expect(current.getEditTarget()).toBe(captured);
  expect([...current.getEditors().keys()]).toEqual(["page:second"]);
  expect(current.prepareEdits()).toBe(true);
  expect(current.getEditTarget()?.id).toBe("page:second");
});

test("navigation readiness waits for the route and binds only its confirmed destination", async () => {
  current.registerEditor("page:first", editor());
  current.prepareEdits();
  current.registerEditor("page:second", editor());
  let ready = false;
  const wait = current.whenEditorReady("page:second").then(() => {
    ready = true;
  });
  await Promise.resolve();
  expect(ready).toBe(false);
  await render("/pages/second");
  await wait;
  expect(current.prepareEdits("page:second")).toBe(true);
  expect(current.getEditTarget()?.id).toBe("page:second");
  await render("/pages/third");
  expect(current.prepareEdits("page:second")).toBe(false);
  expect(current.getEditTarget()).toBeUndefined();
});
