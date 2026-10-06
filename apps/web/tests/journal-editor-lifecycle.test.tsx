// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement, useMemo } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { JournalDraftsProvider } from "../src/app/(app)/journal/_components/journal-drafts-provider";
import {
  JournalEntryEditor,
  JournalEntryProvider,
} from "../src/app/(app)/journal/_components/journal-entry-editor";
import type { BlockTransaction, JournalListEntry } from "../src/trpc";

const mocks = vi.hoisted(() => ({
  edit: (_text: string) => {},
  load: vi.fn(),
  save: vi.fn(),
  setEditor: vi.fn(),
  unsetEditor: vi.fn(),
}));

vi.mock("../src/trpc/react", () => ({
  useTRPC: () => ({
    journal: {
      getByDate: {
        queryKey: ({ date }: { date: string }) => ["entry", date],
        queryOptions: ({ date }: { date: string }) => ({
          queryFn: mocks.load,
          queryKey: ["entry", date],
        }),
      },
      getEntries: { infiniteQueryKey: () => ["entries"] },
      getTimeline: { infiniteQueryKey: () => ["timeline"] },
      saveTransactions: { mutationOptions: () => ({ mutationFn: mocks.save }) },
    },
  }),
}));

vi.mock("../src/hooks/use-journl-agent", () => ({
  useJournlAgent: () => ({
    setEditor: mocks.setEditor,
    unsetEditor: mocks.unsetEditor,
  }),
}));

vi.mock("../src/components/editor/use-block-editor", () => ({
  useBlockEditor: ({
    initialBlocks,
    resetKey,
  }: {
    initialBlocks?: { content: string }[];
    resetKey: number;
  }) =>
    // biome-ignore lint/correctness/useExhaustiveDependencies: Match BlockNote's mount/reset-only initialization, not a controlled editor.
    useMemo(
      () => ({
        blocksToMarkdownLossy: async () => "draft backup",
        document: initialBlocks ?? [
          { content: "", id: "block", type: "paragraph" },
        ],
      }),
      [resetKey],
    ),
}));

vi.mock("../src/components/editor/block-editor", () => ({
  BlockEditor: ({
    editor,
    onChange,
  }: {
    editor: { document: { content: string }[] };
    onChange: (transactions: BlockTransaction[]) => void;
  }) => {
    mocks.edit = (text: string) => {
      editor.document = [
        { content: text, id: "block", type: "paragraph" } as {
          content: string;
        },
      ];
      onChange([
        {
          args: {
            data: { content: text, type: "paragraph" },
            id: "block",
            parent_id: null,
          },
          type: "block_upsert",
        },
      ]);
    };
    return createElement(
      "div",
      { "data-testid": "editor" },
      editor.document[0]?.content,
    );
  },
}));

const v1 = "2026-09-29T12:00:00.000001Z";
const v2 = "2026-09-29T12:00:00.000002Z";
const v3 = "2026-09-29T12:00:00.000003Z";
const entry = {
  blocks: [{ content: "old", id: "block", type: "paragraph" as const }],
  created_at: v1,
  date: "2026-09-29",
  document_id: "document",
  id: "entry",
  updated_at: v1,
  user_id: "user",
} satisfies JournalListEntry;

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.save.mockReset().mockResolvedValue({ ...entry, updated_at: v2 });
  mocks.load.mockReset().mockResolvedValue(entry);
  queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  queryClient.clear();
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function render(show = true, current: JournalListEntry = entry) {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          JournalDraftsProvider,
          null,
          show &&
            createElement(
              JournalEntryProvider,
              { entry: current },
              createElement(JournalEntryEditor, { debounceTime: 150 }),
            ),
        ),
      ),
    );
  });
}

async function edit(text: string) {
  await act(async () => mocks.edit(text));
}

test("scrolling unmounts and remounts an editor with its unsaved writing intact", async () => {
  let finish!: (value: unknown) => void;
  mocks.save.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render();
  await edit("keep this text");
  await render(false);
  await render();
  expect(container.querySelector('[data-testid="editor"]')?.textContent).toBe(
    "keep this text",
  );
  await act(async () => finish({ ...entry, updated_at: v2 }));
});

test("a saved draft yields to refreshed remote content on remount", async () => {
  await render();
  await edit("local");
  await act(async () => vi.advanceTimersByTimeAsync(150));
  await render(false);
  await render(true, {
    ...entry,
    blocks: [{ content: "new remote text", id: "block", type: "paragraph" }],
    updated_at: v3,
  });
  expect(container.querySelector('[data-testid="editor"]')?.textContent).toBe(
    "new remote text",
  );
});

test("retry controls recover from a transient failure while editing remains available", async () => {
  mocks.save.mockRejectedValueOnce(new Error("Offline"));
  await render();
  await edit("first");
  await act(async () => vi.advanceTimersByTimeAsync(150));
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  await edit("newest");
  const retry = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Retry save",
  );
  await act(async () => retry?.click());
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.querySelector('[data-testid="editor"]')?.textContent).toBe(
    "newest",
  );
  expect(mocks.save).toHaveBeenCalledTimes(3);
});

test("conflict recovery resets the mounted editor after downloading the local draft", async () => {
  mocks.save.mockRejectedValueOnce(new Error("Conflict"));
  mocks.load.mockResolvedValue({
    ...entry,
    blocks: [{ content: "remote", id: "block", type: "paragraph" }],
    updated_at: v3,
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:backup"),
    revokeObjectURL: vi.fn(),
  });
  await render();
  await edit("local");
  await act(async () => vi.advanceTimersByTimeAsync(150));
  await act(async () =>
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent === "Retry save")
      ?.click(),
  );
  const recover = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Download draft and load saved entry",
  );
  expect(recover).toBeDefined();
  await act(async () => recover?.click());
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  expect(container.querySelector('[data-testid="editor"]')?.textContent).toBe(
    "remote",
  );
  expect(container.querySelector('[role="alert"]')).toBeNull();
});
