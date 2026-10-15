// @vitest-environment jsdom
import type { DragOverEvent } from "@dnd-kit/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { getInsideDropId } from "~/lib/tree-model";
import { useTreeController } from "./use-tree-controller";

vi.mock("~/hooks/use-move-tree-item", () => ({
  useMoveTreeItem: () => ({
    isPending: false,
    loadedItems: () => [],
    mutate: vi.fn(),
  }),
}));

test("drag-hover expansion never calls persistence and closes when the drag is cancelled", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const setFolderOpen = vi.fn();
  let controller!: ReturnType<typeof useTreeController>;
  function Harness() {
    controller = useTreeController({ openFolders: {}, setFolderOpen });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(() => root.render(<Harness />));
    await act(() =>
      controller.dndContextProps.onDragOver({
        over: { id: getInsideDropId("folder") },
      } as DragOverEvent),
    );
    await act(() => vi.advanceTimersByTime(701));
    expect(controller.openFolders.folder).toBe(true);
    expect(setFolderOpen).not.toHaveBeenCalled();
    await act(() =>
      controller.dndContextProps.onDragCancel(
        {} as Parameters<typeof controller.dndContextProps.onDragCancel>[0],
      ),
    );
    expect(controller.openFolders.folder).toBeUndefined();
  } finally {
    await act(() => root.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
