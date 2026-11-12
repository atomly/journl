// @vitest-environment jsdom
import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { useNavigateJournalEntryTool } from "./navigate-journal-entry/client";
import { useNavigatePageTool } from "./navigate-page/client";

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(() => true),
  push: vi.fn(),
  ready: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("~/hooks/use-journl-agent", () => ({
  useJournlAgent: () => ({
    prepareEdits: mocks.prepare,
    whenEditorReady: mocks.ready,
  }),
}));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

for (const kind of ["page", "journal"] as const) {
  test(`${kind} navigation reports its relative link only when the editor is ready`, async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    let resolve!: () => void;
    mocks.ready.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    let tools:
      | {
          page: ReturnType<typeof useNavigatePageTool>;
          journal: ReturnType<typeof useNavigateJournalEntryTool>;
        }
      | undefined;
    function Mount() {
      tools = {
        journal: useNavigateJournalEntryTool(),
        page: useNavigatePageTool(),
      };
      return null;
    }
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(<Mount />));
    const output = vi.fn();
    const chat = { addToolOutput: output } as unknown as Chat<UIMessage>;
    try {
      const run =
        kind === "page"
          ? tools?.page.execute(
              {
                input: { id: "00000000-0000-4000-8000-000000000001" },
                toolCallId: "navigation",
                toolName: "navigatePage",
              },
              chat,
            )
          : tools?.journal.execute(
              {
                input: { date: "2026-01-01" },
                toolCallId: "navigation",
                toolName: "navigateJournalEntry",
              },
              chat,
            );
      const path =
        kind === "page"
          ? "/pages/00000000-0000-4000-8000-000000000001"
          : "/journal/2026-01-01";
      expect(mocks.push).toHaveBeenCalledWith(path);
      expect(output).not.toHaveBeenCalled();
      expect(mocks.ready).toHaveBeenCalledWith(
        kind === "page"
          ? "page:00000000-0000-4000-8000-000000000001"
          : "journal-entry:2026-01-01",
      );
      resolve();
      await run;
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          output: expect.objectContaining({ link: path }),
        }),
      );
    } finally {
      await act(async () => root.unmount());
    }
  });
}
