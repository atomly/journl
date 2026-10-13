// @vitest-environment jsdom

import { act, type MouseEventHandler, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AppSidebarPages } from "~/app/(app)/@appSidebar/_components/app-sidebar-pages";
import { SidebarProvider } from "~/components/ui/sidebar";

const fixture = vi.hoisted(() => ({ mobile: false, move: vi.fn() }));
vi.mock("~/hooks/use-mobile", () => ({ useIsMobile: () => fixture.mobile }));
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  usePathname: () => "/journal",
}));
vi.mock("~/app/(app)/@appSidebar/_components/app-sidebar-tree-actions", () => ({
  AppSidebarTreeActions: () => null,
}));
vi.mock("~/app/(app)/@appSidebar/_components/delete-page-button", async () => {
  const { cloneElement, createContext, isValidElement, useContext } =
    await import("react");
  const DeleteContext = createContext<(open: boolean) => void>(() => {});
  return {
    DeletePageButton: ({
      children,
      onClick,
    }: {
      children?: ReactNode;
      onClick?: MouseEventHandler<HTMLButtonElement>;
    }) => (
      <button type="button" aria-label="Delete page" onClick={onClick}>
        {children ?? "Delete"}
      </button>
    ),
    DeletePageDialog: ({
      children,
      open,
      onOpenChange,
    }: {
      children: ReactNode;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }) => (
      <DeleteContext.Provider value={onOpenChange}>
        {children}
        {open && <div role="dialog">Confirm delete</div>}
      </DeleteContext.Provider>
    ),
    DeletePageDialogTrigger: ({ children }: { children: ReactNode }) => {
      const setOpen = useContext(DeleteContext);
      if (!isValidElement<{ onClick: () => void }>(children))
        throw new Error("Expected a trigger element");
      return cloneElement(children, { onClick: () => setOpen(true) });
    },
  };
});
vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    tree: {
      getAncestorPath: { queryOptions: () => ({}) },
      getChildrenPaginated: {
        infiniteQueryFilter: () => ({}),
        infiniteQueryKey: () => [],
        infiniteQueryOptions: (input: { parent_node_id: string | null }) =>
          input,
      },
      moveItem: { mutationOptions: () => ({}) },
    },
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: ({
    parent_node_id,
  }: {
    parent_node_id: string | null;
  }) => ({
    data: {
      pages: [
        {
          items:
            parent_node_id === null
              ? [
                  {
                    edge_id: "page-edge",
                    kind: "page",
                    node_id: "page-node",
                    page: {
                      edge_id: "page-edge",
                      id: "page",
                      node_id: "page-node",
                      title: "Source page",
                    },
                    parent_node_id: null,
                  },
                  {
                    edge_id: "folder-edge",
                    folder: {
                      edge_id: "folder-edge",
                      id: "folder",
                      name: "Target folder",
                      node_id: "folder-node",
                    },
                    kind: "folder",
                    node_id: "folder-node",
                    parent_node_id: null,
                  },
                  {
                    edge_id: "target-edge",
                    kind: "page",
                    node_id: "target-node",
                    page: {
                      edge_id: "target-edge",
                      id: "target",
                      node_id: "target-node",
                      title: "Target page",
                    },
                    parent_node_id: null,
                  },
                ]
              : [],
        },
      ],
    },
    hasNextPage: false,
    isFetchingNextPage: false,
    isPending: false,
  }),
  useIsFetching: () => 0,
  useMutation: () => ({ mutate: fixture.move }),
  useQuery: () => ({}),
  useQueryClient: () => ({}),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fixture.mobile = false;
  fixture.move.mockReset();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const row = this.closest("li");
      const label = row?.textContent ?? "";
      let top = label.includes("Source page")
        ? 0
        : label.includes("Target folder")
          ? 36
          : 72;
      let height = 36;
      if (this.classList.contains("h-1/2")) {
        height = 18;
        if (this.classList.contains("bottom-0")) top += 18;
      } else if (this.classList.contains("h-2")) {
        height = 8;
        if (this.classList.contains("bottom-0")) top += 28;
      } else if (this.classList.contains("inset-y-2")) {
        top += 8;
        height = 20;
      }
      return new DOMRect(0, row ? top : 0, 200, row ? height : 108);
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
    // dnd-kit removes its document listeners 50 ms after a sensor detaches.
    await vi.advanceTimersByTimeAsync(60);
  });
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, "setPointerCapture");
  Reflect.deleteProperty(HTMLElement.prototype, "releasePointerCapture");
});

async function render(mobile = false) {
  fixture.mobile = mobile;
  await act(async () =>
    root.render(
      <SidebarProvider>
        <AppSidebarPages />
      </SidebarProvider>,
    ),
  );
}

function pageLink(id: string, mobile = false) {
  const links = container.querySelectorAll<HTMLAnchorElement>(
    `a[href='/pages/${id}']`,
  );
  const link = links[mobile ? 0 : 1];
  expect(link).toBeDefined();
  if (!link) throw new Error("Page link missing");
  return link;
}

async function mouse(target: EventTarget, type: string, y: number) {
  await act(async () => {
    target.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        button: 0,
        cancelable: true,
        clientX: 80,
        clientY: y,
      }),
    );
  });
}

async function touch(target: EventTarget, type: string, x: number, y: number) {
  await act(async () => {
    const point = { clientX: x, clientY: y, identifier: 1, target } as Touch;
    const event = new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      changedTouches: [point],
      touches: type === "touchend" ? [] : [point],
    });
    target.dispatchEvent(event);
  });
}

async function pointer(
  target: EventTarget,
  type: string,
  x: number,
  y: number,
) {
  await act(async () => {
    const event = new MouseEvent(type, {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: x,
      clientY: y,
    });
    Object.defineProperties(event, {
      pointerId: { value: 1 },
      pointerType: { value: "touch" },
    });
    target.dispatchEvent(event);
  });
}

test.each(["page", "folder"])(
  "mouse dragging a %s reorders at the middle of a page row",
  async (kind) => {
    await render();
    const source =
      kind === "page"
        ? pageLink("page")
        : container.querySelector<HTMLElement>(
            "button[aria-label='Expand folder']",
          );
    if (!source) throw new Error("Drag source missing");
    const y = kind === "page" ? 18 : 54;
    if (kind === "page") expect(source.draggable).toBe(false);
    await mouse(source, "mousedown", y);
    await mouse(document, "mousemove", y + 6);
    await mouse(document, "mousemove", 96);
    await mouse(document, "mouseup", 96);
    expect(fixture.move).toHaveBeenCalledExactlyOnceWith({
      destination: {
        anchor_edge_id: "target-edge",
        parent_node_id: null,
        position: "after",
      },
      node_id: kind === "page" ? "page-node" : "folder-node",
    });
  },
);

test("dragging a page into a folder works", async () => {
  await render();
  await mouse(pageLink("page"), "mousedown", 18);
  await mouse(document, "mousemove", 24);
  await mouse(document, "mousemove", 54);
  await mouse(document, "mouseup", 54);
  expect(fixture.move).toHaveBeenCalledExactlyOnceWith({
    destination: { parent_node_id: "folder-node" },
    node_id: "page-node",
  });
});

test.each(["Delete page", "Drag reference to Source page"])(
  "%s controls do not activate tree dragging",
  async (label) => {
    await render();
    const control = pageLink("page").parentElement?.querySelector<HTMLElement>(
      `button[aria-label='${label}']`,
    );
    if (!control) throw new Error("Action control missing");
    await mouse(control, "mousedown", 18);
    await mouse(document, "mousemove", 96);
    await mouse(document, "mouseup", 96);
    expect(fixture.move).not.toHaveBeenCalled();
  },
);

test("dropping outside the tree does not move a page", async () => {
  await render();
  await mouse(pageLink("page"), "mousedown", 18);
  await mouse(document, "mousemove", 24);
  await mouse(document, "mousemove", 120);
  await mouse(document, "mouseup", 120);
  expect(fixture.move).not.toHaveBeenCalled();
});

test("the reference handle still produces an editor reference payload", async () => {
  await render();
  const handle = pageLink(
    "page",
  ).parentElement?.querySelector<HTMLButtonElement>("button[draggable=true]");
  expect(handle).not.toBeNull();
  const dataTransfer = { effectAllowed: "none", setData: vi.fn() };
  await act(async () => {
    const event = new Event("dragstart", { bubbles: true });
    Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
    handle?.dispatchEvent(event);
  });
  expect(dataTransfer.effectAllowed).toBe("copy");
  expect(dataTransfer.setData).toHaveBeenCalledExactlyOnceWith(
    "application/x-journl-page-reference",
    JSON.stringify({ pageId: "page" }),
  );
  expect(fixture.move).not.toHaveBeenCalled();
});

test("a quick full swipe still opens deletion confirmation without moving a page", async () => {
  await render(true);
  const link = pageLink("page", true);
  await pointer(link, "pointerdown", 180, 18);
  await touch(link, "touchstart", 180, 18);
  await pointer(link, "pointermove", 20, 18);
  await touch(link, "touchmove", 20, 18);
  await pointer(link, "pointerup", 20, 18);
  await touch(link, "touchend", 20, 18);
  expect(container.querySelector("[role=dialog]")?.textContent).toBe(
    "Confirm delete",
  );
  expect(fixture.move).not.toHaveBeenCalled();
});

test("holding before dragging disables swipe deletion and moves the page", async () => {
  await render(true);
  const link = pageLink("page", true);
  await pointer(link, "pointerdown", 180, 18);
  await touch(link, "touchstart", 180, 18);
  await act(async () => vi.advanceTimersByTimeAsync(310));
  expect(
    link
      .closest("[data-slot=swipe-action-content]")
      ?.getAttribute("data-disabled"),
  ).toBe("true");
  await pointer(link, "pointermove", 20, 54);
  await touch(link, "touchmove", 20, 54);
  await pointer(link, "pointerup", 20, 54);
  await touch(link, "touchend", 20, 54);
  expect(container.querySelector("[role=dialog]")).toBeNull();
  expect(fixture.move).toHaveBeenCalledExactlyOnceWith({
    destination: { parent_node_id: "folder-node" },
    node_id: "page-node",
  });
  expect(
    link
      .closest("[data-slot=swipe-action-content]")
      ?.getAttribute("data-disabled"),
  ).toBe("false");
});

test("touch dragging a folder still reorders pages", async () => {
  await render(true);
  const source = container.querySelector<HTMLElement>(
    "button[aria-label='Expand folder']",
  );
  if (!source) throw new Error("Folder drag source missing");
  await touch(source, "touchstart", 80, 54);
  await act(async () => vi.advanceTimersByTimeAsync(310));
  await touch(source, "touchmove", 80, 96);
  await touch(source, "touchend", 80, 96);
  expect(fixture.move).toHaveBeenCalledExactlyOnceWith({
    destination: {
      anchor_edge_id: "target-edge",
      parent_node_id: null,
      position: "after",
    },
    node_id: "folder-node",
  });
});

test("vertical touch scrolling cancels pending drag and permits the next drag", async () => {
  await render(true);
  const link = pageLink("page", true);
  await pointer(link, "pointerdown", 80, 18);
  await touch(link, "touchstart", 80, 18);
  await pointer(link, "pointermove", 80, 40);
  await touch(link, "touchmove", 80, 40);
  await pointer(link, "pointerup", 80, 40);
  await touch(link, "touchend", 80, 40);
  await act(async () => vi.advanceTimersByTimeAsync(310));
  expect(fixture.move).not.toHaveBeenCalled();
  expect(
    link
      .closest("[data-slot=swipe-action-content]")
      ?.getAttribute("data-state"),
  ).toBe("closed");
  await touch(link, "touchstart", 80, 18);
  await act(async () => vi.advanceTimersByTimeAsync(310));
  await touch(link, "touchmove", 80, 54);
  await touch(link, "touchend", 80, 54);
  expect(fixture.move).toHaveBeenCalledExactlyOnceWith({
    destination: { parent_node_id: "folder-node" },
    node_id: "page-node",
  });
});

test("a partial swipe reveals a working delete action", async () => {
  await render(true);
  const link = pageLink("page", true);
  await pointer(link, "pointerdown", 180, 18);
  await touch(link, "touchstart", 180, 18);
  await pointer(link, "pointermove", 120, 18);
  await touch(link, "touchmove", 120, 18);
  await pointer(link, "pointerup", 120, 18);
  await touch(link, "touchend", 120, 18);
  expect(
    link
      .closest("[data-slot=swipe-action-content]")
      ?.getAttribute("data-state"),
  ).toBe("open");
  const action = link
    .closest("[data-slot=swipe-action]")
    ?.querySelector<HTMLButtonElement>(
      "[data-slot=swipe-action-reveal] button",
    );
  expect(action).not.toBeNull();
  await act(async () => action?.click());
  expect(container.querySelector("[role=dialog]")?.textContent).toBe(
    "Confirm delete",
  );
  expect(fixture.move).not.toHaveBeenCalled();
});
