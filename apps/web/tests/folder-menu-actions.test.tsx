// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { FolderNestedPagesList } from "~/app/(app)/folders/_components/folder-nested-pages-list";

vi.mock("next/navigation", () => ({ usePathname: () => "/pages" }));
vi.mock("~/components/ui/sidebar", () => ({
  useSidebar: () => ({ isMobile: false, setOpenMobile: vi.fn() }),
}));
vi.mock("~/app/(app)/@appSidebar/_components/app-sidebar-tree-actions", () => ({
  AppSidebarTreeActions: () => null,
}));
vi.mock("~/app/(app)/@appSidebar/_components/delete-folder-button", () => ({
  DeleteFolderDialog: ({
    children,
    open,
  }: {
    children: ReactNode;
    open: boolean;
  }) => (
    <div>
      {children}
      {open && <div role="dialog">Delete folder</div>}
    </div>
  ),
}));
vi.mock("~/app/(app)/@appSidebar/_components/delete-page-button", () => ({
  DeletePageDialog: ({
    children,
    open,
  }: {
    children: ReactNode;
    open: boolean;
  }) => (
    <div>
      {children}
      {open && <div role="dialog">Delete page</div>}
    </div>
  ),
}));
vi.mock("~/trpc/react", () => ({
  useTRPC: () => {
    const mutation = { mutationKey: () => [], mutationOptions: () => ({}) };
    const query = {
      infiniteQueryFilter: () => ({}),
      infiniteQueryOptions: (input: { parent_node_id: string | null }) => input,
    };
    return {
      folders: { getByUser: { queryOptions: () => ({}) }, rename: mutation },
      pages: { updateTitle: mutation },
      tree: {
        getChildrenPaginated: query,
        getNestedPagesPaginated: query,
        moveItem: mutation,
      },
    };
  },
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
                      id: "page",
                      node_id: "page-node",
                      title: "A page",
                      updated_at: "2026-01-01",
                    },
                    parent_node_id: null,
                  },
                  {
                    edge_id: "folder-edge",
                    folder: {
                      id: "folder",
                      name: "A folder",
                      node_id: "folder-node",
                      updated_at: "2026-01-01",
                    },
                    kind: "folder",
                    node_id: "folder-node",
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
  useIsMutating: () => 0,
  useMutation: () => ({ mutate: vi.fn() }),
  useQuery: () => ({}),
  useQueryClient: () => ({ getQueriesData: () => [] }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

test.each([
  ["Page", "Rename", "click"],
  ["Page", "Delete", "click"],
  ["Folder", "Rename", "click"],
  ["Folder", "Delete", "click"],
  ["Page", "Rename", "Enter"],
  ["Page", "Delete", "Enter"],
  ["Folder", "Rename", "Enter"],
  ["Folder", "Delete", "Enter"],
])("%s settings %s works via %s", async (kind, action, activation) => {
  await act(async () => root.render(<FolderNestedPagesList />));
  const trigger = container.querySelector<HTMLButtonElement>(
    `button[aria-label='${kind} settings']`,
  );
  expect(trigger).not.toBeNull();
  await act(async () => trigger?.click());
  const item = Array.from(
    document.querySelectorAll<HTMLElement>("[role=menuitem]"),
  ).find((element) => element.textContent === action);
  expect(item).toBeDefined();
  await act(async () => {
    if (activation === "click") item?.click();
    else {
      item?.focus();
      item?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
      );
    }
  });
  if (action === "Rename") {
    const input = container.querySelector<HTMLInputElement>(
      "input:not([type=hidden])",
    );
    expect(input?.value).toBe(kind === "Page" ? "A page" : "A folder");
    expect(document.activeElement).toBe(input);
  } else {
    expect(container.querySelector("[role=dialog]")?.textContent).toBe(
      kind === "Page" ? "Delete page" : "Delete folder",
    );
  }
});
