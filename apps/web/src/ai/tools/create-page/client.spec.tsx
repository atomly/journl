// @vitest-environment jsdom
import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { useCreatePageTool } from "./client";

const mocks = vi.hoisted(() => ({
  buffer: vi.fn(),
  create: vi.fn(),
  prepare: vi.fn(() => true),
  push: vi.fn(),
  ready: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutateAsync: mocks.create }),
  useQueryClient: () => ({}),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("~/components/events/app-event-context", () => ({
  useAppEventEmitter: () => ({ buffer: mocks.buffer }),
}));
vi.mock("~/hooks/use-journl-agent", () => ({
  useJournlAgent: () => ({
    prepareEdits: mocks.prepare,
    whenEditorReady: mocks.ready,
  }),
}));
vi.mock("~/trpc/cache/tree-cache", () => ({ insertItem: vi.fn() }));
vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    tree: {
      createPage: { mutationOptions: () => ({}) },
      getChildrenPaginated: { infiniteQueryKey: () => [] },
    },
  }),
}));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

test.each([
  { editorReady: true, readinessTimesOut: false },
  { editorReady: false, readinessTimesOut: true },
  { editorReady: false, readinessTimesOut: false },
])(
  "creation remains successful when editorReady=$editorReady and readinessTimesOut=$readinessTimesOut",
  async ({ editorReady, readinessTimesOut }) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const page = {
      id: "00000000-0000-4000-8000-000000000001",
      title: "Incremental table acceptance",
    };
    mocks.create.mockResolvedValue({ page });
    mocks.ready.mockImplementation(async () => {
      if (readinessTimesOut) throw new Error("Timed out");
    });
    mocks.prepare.mockReturnValue(editorReady);
    let tool: ReturnType<typeof useCreatePageTool> | undefined;
    function Mount() {
      tool = useCreatePageTool();
      return null;
    }
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(<Mount />));
    const output = vi.fn();
    try {
      await tool?.execute(
        {
          input: { title: page.title },
          toolCallId: "create",
          toolName: "createPage",
        },
        { addToolOutput: output } as unknown as Chat<UIMessage>,
      );
      expect(mocks.create).toHaveBeenCalledTimes(1);
      expect(mocks.push).toHaveBeenCalledExactlyOnceWith(`/pages/${page.id}`);
      expect(mocks.prepare).toHaveBeenCalledWith(`page:${page.id}`);
      expect(output).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          output: expect.objectContaining({
            editorReady,
            link: `/pages/${page.id}`,
            page,
          }),
        }),
      );
      expect(output.mock.calls[0]?.[0].output.status).not.toBe("error");
      if (!editorReady)
        expect(output.mock.calls[0]?.[0].output.message).toContain(
          "Do not create another page",
        );
    } finally {
      await act(async () => root.unmount());
    }
  },
);
