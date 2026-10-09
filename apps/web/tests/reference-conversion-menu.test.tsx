// @vitest-environment jsdom
import {
  type EditorPartialBlock,
  type EditorPrimitive,
  schema,
} from "@acme/blocknote/schema";
import { BlockNoteEditor } from "@blocknote/core";
import { FormattingToolbar } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { BlockEditorFormattingItems } from "../src/components/editor/block-editor-tools";
import {
  captureReferenceLink,
  convertCapturedReferenceLink,
} from "../src/components/editor/reference-link-conversion";
import { ReferenceRuntime } from "../src/components/references/reference-runtime";
import * as DropdownMenu from "../src/components/ui/dropdown-menu";
import * as Popover from "../src/components/ui/popover";

const URL = "https://github.com/atomly/journl/pull/302";
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  resolve: vi.fn(),
  unavailable: false,
}));
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
                  metadataState: "url-only",
                  status: "ready",
                  title: "Fallback",
                },
              },
            ],
          }),
          queryKey: ["preview", input],
        }),
      },
      resolveUrls: {
        queryOptions: (input: { urls: string[] }) => ({
          queryFn: async () => {
            mocks.resolve(input);
            return {
              items: [
                {
                  preview: {
                    metadataState: "url-only",
                    status: "ready",
                    title: input.urls[0],
                  },
                  target: mocks.unavailable
                    ? null
                    : { kind: "external", url: input.urls[0] },
                },
              ],
            };
          },
          queryKey: ["resolve", input],
        }),
      },
    },
  }),
}));
vi.mock("../src/hooks/use-journl-agent", () => ({
  useJournlAgent: () => ({}),
}));
vi.mock("../src/hooks/use-mobile", () => ({ useIsMobile: () => false }));
const cleanup: Array<() => void> = [];
beforeAll(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(async () => {
  await act(async () => {
    for (const fn of cleanup.splice(0)) fn();
  });
  mocks.unavailable = false;
  mocks.resolve.mockClear();
});
function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Missing test fixture");
  return value;
}
async function setup(initialContent?: EditorPartialBlock[]) {
  const editor = BlockNoteEditor.create({
    initialContent: initialContent ?? [
      {
        children: [{ content: "Nested", id: "child", type: "paragraph" }],
        content: [
          { styles: { bold: true }, text: "Prefix ", type: "text" },
          {
            content: [
              {
                styles: { italic: true },
                text: "Custom PR alias",
                type: "text",
              },
            ],
            href: URL,
            type: "link",
          },
          { styles: { underline: true }, text: " suffix", type: "text" },
        ],
        id: "source",
        type: "paragraph",
      },
    ],
    schema,
  }) as EditorPrimitive;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const state = editor._tiptapEditor.state;
  let from = 0;
  state.doc.descendants((node, pos) => {
    if (node.isText && node.text === "Custom PR alias") from = pos;
  });
  if (from)
    editor._tiptapEditor.view.dispatch(
      state.tr.setSelection(
        TextSelection.create(state.doc, from, from + "Custom PR alias".length),
      ),
    );
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <ReferenceRuntime editor={editor}>
          <BlockNoteView
            editor={editor}
            formattingToolbar={false}
            sideMenu={false}
            shadCNComponents={{ DropdownMenu, Popover }}
          >
            <FormattingToolbar>
              <BlockEditorFormattingItems />
            </FormattingToolbar>
          </BlockNoteView>
        </ReferenceRuntime>
      </QueryClientProvider>,
    ),
  );
  cleanup.push(() => {
    root.unmount();
    editor._tiptapEditor.destroy();
    host.remove();
    client.clear();
  });
  return { editor, host };
}
async function click(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        button: 0,
        cancelable: true,
      }),
    );
    element.click();
  });
}
async function openDisplayMenu(host: HTMLElement) {
  const trigger = required(
    host.querySelector<HTMLElement>('[aria-label="Reference display options"]'),
  );
  await click(trigger);
  const items = [
    ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ];
  return required(items.find((element) => element.textContent === "Card"));
}

test("mounted link display menu converts at captured range after pointer focus moves, without metadata", async () => {
  const { editor, host } = await setup();
  const original = editor.document;
  const card = await openDisplayMenu(host);
  // Native menu focus can collapse selection. This must not discard the captured link.
  await act(async () => editor.setTextCursorPosition("child", "end"));
  await click(card);
  await vi.waitFor(() =>
    expect(editor.document[1]?.type).toBe("referenceCard"),
  );
  expect(editor.document[0]?.id).toBe("source");
  expect(editor.document[0]?.children[0]?.id).toBe("child");
  expect(editor.document[0]?.content).toEqual([
    expect.objectContaining({ styles: { bold: true }, text: "Prefix " }),
  ]);
  expect(editor.document[1]?.props).toEqual(
    expect.objectContaining({ label: "Custom PR alias", url: URL }),
  );
  expect(editor.document[2]?.content).toEqual([
    expect.objectContaining({ styles: { underline: true }, text: " suffix" }),
  ]);
  await act(async () => {
    expect(editor.undo()).toBe(true);
  });
  expect(editor.document).toEqual(original);
});

test("mounted link display menu keeps the source link unchanged when target is unavailable", async () => {
  mocks.unavailable = true;
  const { editor, host } = await setup();
  const original = editor.document;
  const card = await openDisplayMenu(host);
  await click(card);
  await vi.waitFor(() => expect(mocks.resolve).toHaveBeenCalled());
  expect(editor.document).toEqual(original);
});

test("captured conversion refuses stale document after text changes rather than replacing unrelated content", async () => {
  const { editor } = await setup();
  const captured = required(captureReferenceLink(editor));
  await act(async () =>
    editor.updateBlock("child", { content: "Edited while loading" }),
  );
  const adapter = { convertInline: vi.fn() };
  const result = await convertCapturedReferenceLink(
    editor,
    adapter as never,
    captured,
    "referenceCard",
    async () =>
      ({
        items: [
          {
            preview: { status: "unavailable" },
            target: { kind: "external", url: URL },
          },
        ],
      }) as never,
  );
  expect(result).toBe("changed");
  expect(adapter.convertInline).not.toHaveBeenCalled();
  expect(editor.getBlock("source")?.content).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ href: URL, type: "link" }),
    ]),
  );
});

test("mounted second badge display menu extracts the exact occurrence inside nested styled text", async () => {
  const props = { targetKind: "external" as const, url: URL, version: 1 };
  const { editor, host } = await setup([
    {
      children: [
        {
          children: [
            { content: "Keep nested child", id: "child", type: "paragraph" },
          ],
          content: [
            { props: { ...props, label: "First" }, type: "contentReference" },
            { styles: { bold: true }, text: " before ", type: "text" },
            { props: { ...props, label: "Second" }, type: "contentReference" },
            { styles: { italic: true }, text: " after", type: "text" },
          ] as never,
          id: "source",
          props: { level: 3 },
          type: "heading",
        },
      ],
      content: "Parent",
      id: "parent",
      type: "paragraph",
    },
  ]);
  const badges = host.querySelectorAll<HTMLElement>(
    '[data-id="source"] .content-reference',
  );
  await click(required(badges[1]));
  let trigger: HTMLElement | null = null;
  await vi.waitFor(() => {
    trigger = document.querySelector<HTMLElement>(
      '[aria-label="Reference display options"]',
    );
    expect(trigger).not.toBeNull();
  });
  await click(required<HTMLElement>(trigger));
  const item = required(
    [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (node) => node.textContent === "Card",
    ),
  );
  await click(item);
  await vi.waitFor(() =>
    expect(editor.document[0]?.children[1]?.type).toBe("referenceCard"),
  );
  const [prefix, card, suffix] = required(editor.document[0]).children;
  expect(prefix?.id).toBe("source");
  expect(prefix?.type).toBe("heading");
  expect(prefix?.children[0]?.id).toBe("child");
  expect(prefix?.content).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        props: expect.objectContaining({ label: "First" }),
        type: "contentReference",
      }),
      expect.objectContaining({ styles: { bold: true }, text: " before " }),
    ]),
  );
  expect(card?.props).toEqual(
    expect.objectContaining({ label: "Second", url: URL }),
  );
  expect(suffix?.type).toBe("heading");
  expect(suffix?.props).toEqual(expect.objectContaining({ level: 3 }));
  expect(suffix?.content).toEqual([
    expect.objectContaining({ styles: { italic: true }, text: " after" }),
  ]);
});

test("table-cell links offer inline conversion without unsupported card actions", async () => {
  const { host, editor } = await setup([
    {
      content: {
        rows: [
          {
            cells: [
              [
                {
                  content: [
                    { styles: {}, text: "Custom PR alias", type: "text" },
                  ],
                  href: URL,
                  type: "link",
                },
              ],
            ],
          },
        ],
        type: "tableContent",
      } as never,
      id: "table",
      type: "table",
    },
  ]);
  await click(
    required(
      host.querySelector<HTMLElement>(
        '[aria-label="Reference display options"]',
      ),
    ),
  );
  const labels = [
    ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ].map((item) => item.textContent);
  expect(labels).toContain("Inline");
  expect(labels).not.toContain("Card");
  expect(labels).not.toContain("Embed");
  const inline = required(
    [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent === "Inline",
    ),
  );
  await click(inline);
  await vi.waitFor(() =>
    expect(host.querySelector(".content-reference")).not.toBeNull(),
  );
  await click(required(host.querySelector<HTMLElement>(".content-reference")));
  await vi.waitFor(() =>
    expect(
      document.querySelector(
        '.content-reference-preview [aria-label="Reference display options"]',
      ),
    ).not.toBeNull(),
  );
  await click(
    required(
      document.querySelector<HTMLElement>(
        '.content-reference-preview [aria-label="Reference display options"]',
      ),
    ),
  );
  const plain = required(
    [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent === "Link",
    ),
  );
  await click(plain);
  await vi.waitFor(() =>
    expect(JSON.stringify(editor.document)).not.toContain(
      '"type":"contentReference"',
    ),
  );
  expect(JSON.stringify(editor.document)).toContain('"type":"link"');
  expect(JSON.stringify(editor.document)).toContain("Custom PR alias");
});

test("mounted link conversion selects the second identical link without disturbing the first or an earlier badge", async () => {
  const link = {
    content: [{ styles: {}, text: "Custom PR alias", type: "text" as const }],
    href: URL,
    type: "link" as const,
  };
  const { editor, host } = await setup([
    {
      content: [
        link,
        { styles: {}, text: " then ", type: "text" },
        {
          props: {
            label: "Existing badge",
            targetKind: "external",
            url: URL,
            version: 1,
          },
          type: "contentReference",
        },
        { styles: {}, text: " then ", type: "text" },
        link,
        { styles: { italic: true }, text: " suffix", type: "text" },
      ] as never,
      id: "source",
      type: "paragraph",
    },
  ]);
  const card = await openDisplayMenu(host);
  await click(card);
  await vi.waitFor(() =>
    expect(editor.document[1]?.type).toBe("referenceCard"),
  );
  expect(editor.document[0]?.content).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ href: URL, type: "link" }),
      expect.objectContaining({
        props: expect.objectContaining({ label: "Existing badge" }),
        type: "contentReference",
      }),
    ]),
  );
  expect(editor.document[1]?.props).toEqual(
    expect.objectContaining({ label: "Custom PR alias", url: URL }),
  );
  expect(editor.document[2]?.content).toEqual([
    expect.objectContaining({ styles: { italic: true }, text: " suffix" }),
  ]);
});

async function selectNode(
  editor: EditorPrimitive,
  type: string,
  occurrence = 0,
) {
  let seen = 0;
  let position: number | undefined;
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (node.type.name === type && seen++ === occurrence) position = pos;
  });
  await act(async () =>
    editor.prosemirrorView.dispatch(
      editor.prosemirrorState.tr.setSelection(
        NodeSelection.create(editor.prosemirrorState.doc, required(position)),
      ),
    ),
  );
}
async function openReferenceActions(host: HTMLElement) {
  await click(
    required(
      host.querySelector<HTMLElement>('[aria-label="Reference actions"]'),
    ),
  );
  return [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
}
async function chooseReferenceDisplay(label: string) {
  const display = required(
    [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent === "Display as",
    ),
  );
  await act(async () => {
    display.focus();
    display.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }),
    );
  });
  let item: HTMLElement | undefined;
  await vi.waitFor(() => {
    item = [
      ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ].find((node) => node.textContent === label);
    expect(item).toBeDefined();
  });
  await click(required(item));
}

test("selected cards use reference actions instead of generic file controls", async () => {
  const { editor, host } = await setup([
    {
      id: "card",
      props: { label: "PR", targetKind: "external", url: URL },
      type: "referenceCard",
    },
  ]);
  await selectNode(editor, "referenceCard");
  expect(host.querySelector('[aria-label="Reference actions"]')).not.toBeNull();
  expect(
    [...host.querySelectorAll("[aria-label]")]
      .map((node) => node.getAttribute("aria-label"))
      .join(" "),
  ).not.toMatch(/(?:delete|replace|download) file/i);
  const items = await openReferenceActions(host);
  expect(items.map((item) => item.textContent)).toEqual(
    expect.arrayContaining([
      "Display as",
      "Open source",
      "Copy source link",
      "Duplicate",
      "Delete",
    ]),
  );
  await chooseReferenceDisplay("Inline");
  await vi.waitFor(() =>
    expect(editor.getBlock("card")?.content).toEqual([
      expect.objectContaining({
        props: expect.objectContaining({ label: "PR", url: URL }),
        type: "contentReference",
      }),
    ]),
  );
});

test("selected inline badges offer the same actions and convert only the selected occurrence", async () => {
  const props = { targetKind: "external" as const, url: URL };
  const { editor, host } = await setup([
    {
      content: [
        { props: { ...props, label: "First" }, type: "contentReference" },
        { styles: {}, text: " between ", type: "text" },
        { props: { ...props, label: "Second" }, type: "contentReference" },
      ],
      id: "source",
      type: "paragraph",
    } as never,
  ]);
  await selectNode(editor, "contentReference", 1);
  expect(host.querySelector('[aria-label="Reference actions"]')).not.toBeNull();
  const items = await openReferenceActions(host);
  expect(items.map((item) => item.textContent)).toContain("Copy source link");
  await chooseReferenceDisplay("Link");
  await vi.waitFor(() =>
    expect(editor.getBlock("source")?.content).toEqual([
      expect.objectContaining({
        props: expect.objectContaining({ label: "First" }),
        type: "contentReference",
      }),
      expect.objectContaining({ text: " between ", type: "text" }),
      expect.objectContaining({
        content: [expect.objectContaining({ text: "Second" })],
        href: URL,
        type: "link",
      }),
    ]),
  );
});

test("real file selections retain file controls", async () => {
  const { editor, host } = await setup([
    {
      id: "file",
      props: { name: "Report.pdf", url: "https://example.com/file.pdf" },
      type: "file",
    },
  ]);
  await selectNode(editor, "file");
  const labels = [...host.querySelectorAll("[aria-label]")]
    .map((node) => node.getAttribute("aria-label"))
    .join(" ");
  expect(labels).toMatch(/delete file/i);
  expect(labels).toMatch(/download file/i);
  expect(host.querySelector('[aria-label="Reference actions"]')).toBeNull();
});

test("an open reference actions menu refuses a changed source rather than converting an old badge index", async () => {
  const { editor, host } = await setup([
    {
      content: [
        {
          props: { label: "Original", targetKind: "external", url: URL },
          type: "contentReference",
        },
        { styles: {}, text: " after", type: "text" },
      ],
      id: "source",
      type: "paragraph",
    } as never,
  ]);
  await selectNode(editor, "contentReference");
  await openReferenceActions(host);
  await act(async () =>
    editor.updateBlock("source", { content: "Changed while menu was open" }),
  );
  await chooseReferenceDisplay("Card");
  expect(editor.document).toHaveLength(1);
  expect(editor.getBlock("source")?.content).toEqual([
    expect.objectContaining({
      text: "Changed while menu was open",
      type: "text",
    }),
  ]);
});
