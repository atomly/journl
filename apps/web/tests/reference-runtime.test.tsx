// @vitest-environment jsdom

import {
  type EditorPartialBlock,
  type EditorPrimitive,
  type ReferenceRenderAdapter,
  ReferenceRenderContext,
  schema,
} from "@acme/blocknote/schema";
import { BlockNoteEditor } from "@blocknote/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, useContext } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { safeReferenceHref } from "../../../packages/blocknote/src/reference-href";
import { ReferenceRuntime } from "../src/components/references/reference-runtime";

const mocks = vi.hoisted(() => ({ push: vi.fn(), title: "First title" }));
const DOCUMENT = "10000000-0000-4000-8000-000000000001";
const SOURCE = "20000000-0000-4000-8000-000000000002";
const PAGE = "30000000-0000-4000-8000-000000000003";
const target = { documentId: DOCUMENT, kind: "document" as const };
const props = {
  blockId: "",
  documentId: DOCUMENT,
  label: "",
  resolutionToken: "",
  targetKind: "document" as const,
  url: `/pages/${PAGE}`,
  version: 1,
};
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("../src/trpc/react", () => ({
  useTRPC: () => ({
    references: {
      getPreviews: {
        queryOptions: (input: unknown) => ({
          queryFn: async () => ({
            items: [
              {
                preview: {
                  href: `https://journl.example/pages/${PAGE}`,
                  kind: "page",
                  status: "ready",
                  title: mocks.title,
                },
              },
            ],
          }),
          queryKey: ["previews", input],
        }),
      },
    },
  }),
}));
const cleanups: Array<() => void> = [];
afterEach(async () => {
  await act(async () => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });
  mocks.push.mockReset();
  mocks.title = "First title";
});

async function setup(initialContent: EditorPartialBlock[]) {
  const editor = BlockNoteEditor.create({
    initialContent,
    schema,
  }) as EditorPrimitive;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  let adapter: ReferenceRenderAdapter | null = null;
  function Capture() {
    adapter = useContext(ReferenceRenderContext);
    return null;
  }
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <ReferenceRuntime editor={editor}>
          <Capture />
        </ReferenceRuntime>
      </QueryClientProvider>,
    );
  });
  cleanups.push(() => {
    root.unmount();
    element.remove();
    client.clear();
  });
  if (!adapter) throw new Error("Missing reference adapter");
  return { adapter: adapter as ReferenceRenderAdapter, client, editor };
}

test("display conversions preserve the source block ID and its nested blocks", async () => {
  const child = "40000000-0000-4000-8000-000000000004";
  const { adapter, editor } = await setup([
    {
      children: [{ content: "Nested text", id: child, type: "paragraph" }],
      id: SOURCE,
      props,
      type: "referenceCard",
    },
  ]);
  adapter.convertBlock(SOURCE, target, "contentEmbed", "", `/pages/${PAGE}`);
  expect(editor.getBlock(SOURCE)?.type).toBe("contentEmbed");
  expect(editor.getBlock(SOURCE)?.children[0]?.id).toBe(child);
  adapter.convertBlock(SOURCE, target, "link", "First title", `/pages/${PAGE}`);
  expect(editor.getBlock(SOURCE)?.type).toBe("paragraph");
  expect(editor.getBlock(SOURCE)?.children[0]?.id).toBe(child);
});

test("converting the second badge leaves the first occurrence intact", async () => {
  const { adapter, editor } = await setup([
    {
      content: [
        { props: { ...props, label: "First alias" }, type: "contentReference" },
        { styles: {}, text: " and ", type: "text" },
        {
          props: { ...props, label: "Second alias" },
          type: "contentReference",
        },
      ],
      id: SOURCE,
      type: "paragraph",
    },
  ]);
  adapter.convertInline(
    SOURCE,
    target,
    "link",
    "Second alias",
    `/pages/${PAGE}`,
    1,
  );
  const content = editor.getBlock(SOURCE)?.content;
  expect(content).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        props: expect.objectContaining({ label: "First alias" }),
        type: "contentReference",
      }),
      expect.objectContaining({ href: `/pages/${PAGE}`, type: "link" }),
    ]),
  );
});

test("opening an internal reference resolves the page entity route", async () => {
  const { adapter } = await setup([
    { content: "Text", id: SOURCE, type: "paragraph" },
  ]);
  adapter.openTarget(target);
  await vi.waitFor(() =>
    expect(mocks.push).toHaveBeenCalledWith(`/pages/${PAGE}`),
  );
  expect(mocks.push).not.toHaveBeenCalledWith(`/pages/${DOCUMENT}`);
});

test("preview subscribers receive fresh titles after query invalidation", async () => {
  const { adapter, client } = await setup([
    { content: "Text", id: SOURCE, type: "paragraph" },
  ]);
  const listener = vi.fn();
  const unsubscribe = adapter.subscribePreview?.(target, listener);
  cleanups.push(() => unsubscribe?.());
  await vi.waitFor(() =>
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ title: "First title" }),
    ),
  );
  mocks.title = "Renamed note";
  await client.invalidateQueries({ queryKey: ["previews"] });
  expect(listener).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Renamed note" }),
  );
});

test("rendered reference links reject script, credential, and remote relative URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "//evil.example/path",
    "/\\evil.example/path",
    "https://user:password@example.com/path",
  ])
    expect(safeReferenceHref(url)).toBe("#");
  expect(safeReferenceHref("/pages/abc#block=123")).toBe(
    "/pages/abc#block=123",
  );
  expect(safeReferenceHref("https://github.com/atomly/journl")).toBe(
    "https://github.com/atomly/journl",
  );
});
