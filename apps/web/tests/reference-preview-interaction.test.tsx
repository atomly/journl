// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  type ReferencePreviewData,
  ReferenceRenderContext,
} from "../../../packages/blocknote/src/reference-context";
import { contentReference } from "../../../packages/blocknote/src/reference-specs";

vi.mock("@blocknote/react", async () => {
  const React = await import("react");
  const Open = React.createContext(false);
  return {
    createReactBlockSpec: (_config: unknown, spec: unknown) => spec,
    createReactInlineContentSpec: (_config: unknown, spec: unknown) => spec,
    useComponentsContext: () => ({
      Generic: {
        Popover: {
          Content: ({ children }: { children: ReactNode }) =>
            React.useContext(Open) ? <div data-preview>{children}</div> : null,
          Root: ({
            open,
            children,
          }: {
            open: boolean;
            children: ReactNode;
          }) => <Open.Provider value={open}>{children}</Open.Provider>,
          Trigger: ({ children }: { children: ReactNode }) => children,
        },
      },
    }),
    usePortalElement: () => undefined,
  };
});
beforeAll(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
let root: Root | undefined;
let element: HTMLElement | undefined;
afterEach(async () => {
  await act(async () => root?.unmount());
  element?.remove();
  vi.useRealTimers();
});
async function renderBadge(
  url = "https://github.com/atomly/journl/pull/302",
  preview: ReferencePreviewData = {
    excerpt: "Description",
    status: "ready",
    title: "A very long pull request title",
  },
) {
  element = document.createElement("div");
  document.body.append(element);
  root = createRoot(element);
  const spec = contentReference as unknown as {
    render: (props: unknown) => ReactNode;
  };
  await act(async () =>
    root?.render(
      <ReferenceRenderContext.Provider
        value={{
          convertBlock: vi.fn(),
          convertInline: vi.fn(),
          loadEmbedContent: async () => ({ status: "unavailable" }),
          loadPreview: async () => preview,
          openTarget: vi.fn(),
        }}
      >
        {spec.render({
          contentRef: () => {},
          inlineContent: {
            props: { label: "", targetKind: "external", url, version: 1 },
          },
        })}
      </ReferenceRenderContext.Provider>,
    ),
  );
  return element;
}
function requireElement(host: HTMLElement, selector: string) {
  const element = host.querySelector(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}
function mouse(
  element: Element,
  type: string,
  relatedTarget: EventTarget | null = null,
) {
  element.dispatchEvent(new MouseEvent(type, { bubbles: true, relatedTarget }));
}

test("hover preview closes after leaving and remains available while pointer moves into preview", async () => {
  vi.useFakeTimers();
  const host = await renderBadge();
  const badge = requireElement(host, "a");
  await act(async () => mouse(badge, "mouseover"));
  expect(host.querySelector("[data-preview]")).not.toBeNull();
  await act(async () => mouse(badge, "mouseout"));
  const preview = requireElement(host, "[data-preview] > fieldset");
  await act(async () => {
    mouse(preview, "mouseover");
    vi.advanceTimersByTime(200);
  });
  expect(host.querySelector("[data-preview]")).not.toBeNull();
  await act(async () => {
    mouse(preview, "mouseout");
    vi.advanceTimersByTime(200);
  });
  expect(host.querySelector("[data-preview]")).toBeNull();
});

test("click pins preview until keyboard focus leaves", async () => {
  vi.useFakeTimers();
  const host = await renderBadge();
  const badge = requireElement(host, "a");
  await act(async () =>
    badge.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    ),
  );
  expect(host.querySelector("[data-preview]")).not.toBeNull();
  await act(async () => {
    mouse(badge, "mouseout");
    vi.advanceTimersByTime(200);
  });
  expect(host.querySelector("[data-preview]")).not.toBeNull();
  const outside = document.createElement("button");
  document.body.append(outside);
  await act(async () => outside.focus());
  outside.remove();
  expect(host.querySelector("[data-preview]")).toBeNull();
});

test("GitHub badges identify PRs compactly while preview keeps the metadata title", async () => {
  const host = await renderBadge();
  const badge = requireElement(host, "a");
  expect(badge.textContent).toBe("atomly/journl #302");
  await act(async () => mouse(badge, "mouseover"));
  expect(host.querySelector("[data-preview] strong")?.textContent).toBe(
    "A very long pull request title",
  );
});

test("generic inline references fall back to the link path when metadata is unavailable", async () => {
  const host = await renderBadge("https://example.com/articles/useful-notes", {
    metadataState: "url-only",
    status: "ready",
    title: "example.com",
  });
  expect(host.querySelector("a")?.textContent).toBe(
    "example.com/articles/useful-notes",
  );
});
