// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AppSidebarTreeActions } from "~/app/(app)/@appSidebar/_components/app-sidebar-tree-actions";

const fixture = vi.hoisted(() => ({
  createFolder: vi.fn(),
  createPage: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("~/components/ui/sidebar", () => ({
  useSidebar: () => ({ isMobile: false, setOpenMobile: vi.fn() }),
}));
vi.mock("~/components/events/app-event-context", () => ({
  useAppEventEmitter: () => ({ buffer: vi.fn() }),
}));
vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    folders: { getByUser: { queryOptions: () => ({}) } },
    tree: {
      createFolder: {
        mutationOptions: () => ({ mutate: fixture.createFolder }),
      },
      createPage: { mutationOptions: () => ({ mutate: fixture.createPage }) },
      getChildrenPaginated: { infiniteQueryFilter: () => ({}) },
      moveItem: { mutationKey: () => [], mutationOptions: () => ({}) },
    },
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useIsMutating: () => 0,
  useMutation: (options: { mutate: unknown }) => ({
    isPending: false,
    mutate: options.mutate,
  }),
  useQuery: () => ({}),
  useQueryClient: () => ({ getQueriesData: () => [] }),
}));
vi.mock("~/app/(app)/@appSidebar/_components/delete-folder-button", () => ({
  DeleteFolderDialog: () => null,
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fixture.createFolder.mockReset();
  fixture.createPage.mockReset();
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
  ["New page", "click"],
  ["New folder", "click"],
  ["New page", "Enter"],
  ["New folder", "Enter"],
])("Library %s runs its creation action via %s", async (label, activation) => {
  const onCreateStart = vi.fn();
  await act(async () => {
    root.render(
      <AppSidebarTreeActions
        kind="root"
        parentNodeId={null}
        onCreateStart={onCreateStart}
      />,
    );
  });
  const trigger = container.querySelector<HTMLButtonElement>(
    "button[aria-label='Add item']",
  );
  expect(trigger).not.toBeNull();
  await act(async () => trigger?.click());
  const item = Array.from(
    document.querySelectorAll<HTMLElement>("[role=menuitem]"),
  ).find((element) => element.textContent === label);
  expect(item).toBeDefined();
  await act(async () => {
    if (activation === "click") {
      item?.click();
    } else {
      item?.focus();
      item?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: activation }),
      );
      item?.dispatchEvent(
        new KeyboardEvent("keyup", { bubbles: true, key: activation }),
      );
    }
  });

  const mutation =
    label === "New page" ? fixture.createPage : fixture.createFolder;
  const otherMutation =
    label === "New page" ? fixture.createFolder : fixture.createPage;
  expect(mutation).toHaveBeenCalledExactlyOnceWith(
    {
      destination: { parent_node_id: null },
      ...(label === "New page" ? { title: "" } : { name: "New folder" }),
    },
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  );
  expect(otherMutation).not.toHaveBeenCalled();
  expect(onCreateStart).toHaveBeenCalledOnce();
  expect(trigger?.getAttribute("aria-expanded")).toBe("false");
});
