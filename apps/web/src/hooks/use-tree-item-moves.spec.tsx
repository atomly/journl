// @vitest-environment jsdom

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  TreeMoveProvider,
  useTreeItemMoves,
} from "~/hooks/use-tree-item-moves";

const fixture = vi.hoisted(() => ({
  move: vi.fn(),
  pending: false,
  showRow: true,
}));
vi.mock("~/hooks/use-move-tree-item", () => ({
  useMoveTreeItem: () => ({
    isPending: fixture.pending,
    loadedItems: () => [],
    mutate: fixture.move,
  }),
}));
vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({ folders: { getByUser: { queryOptions: () => ({}) } } }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: [
      {
        edge_id: "destination-edge",
        name: "Recipes",
        node_id: "destination",
        parent_node_id: null,
      },
    ],
    isPending: false,
  }),
}));

function SourceRow() {
  const moves = useTreeItemMoves({
    label: "Source page",
    node_id: "source",
    parent_node_id: null,
  });
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger>Source actions</DropdownMenuTrigger>
      <DropdownMenuContent>{moves.menuItems}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function Fixture() {
  return (
    <TreeMoveProvider>
      {fixture.showRow ? <SourceRow /> : <p>Moved source row</p>}
    </TreeMoveProvider>
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fixture.move.mockReset();
  fixture.pending = false;
  fixture.showRow = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function openPickerAndMove() {
  await act(async () => root.render(<Fixture />));
  await act(async () => container.querySelector("button")?.click());
  const item = Array.from(
    document.querySelectorAll<HTMLElement>("[role=menuitem]"),
  ).find((element) => element.textContent === "Move to…");
  await act(async () => item?.click());
  const destination = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) => button.textContent === "Recipes");
  expect(destination).toBeDefined();
  await act(async () => destination?.click());
  expect(fixture.move).toHaveBeenCalledExactlyOnceWith(
    {
      destination: { parent_node_id: "destination", position: "after" },
      node_id: "source",
    },
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  );
  fixture.showRow = false;
  fixture.pending = true;
  await act(async () => root.render(<Fixture />));
  return fixture.move.mock.calls[0]?.[1] as { onSuccess: () => void };
}

test("cross-parent optimistic removal keeps picker mounted and restores focus to the stable library", async () => {
  const callbacks = await openPickerAndMove();
  const dialog = document.querySelector<HTMLElement>("[role=dialog]");
  expect(dialog?.textContent).toContain("Move Source page");
  expect(container.textContent).toContain("Moved source row");
  expect(
    Array.from(
      dialog?.querySelectorAll<HTMLButtonElement>("button") ?? [],
    ).find((button) => button.textContent === "Recipes")?.disabled,
  ).toBe(true);
  fixture.pending = false;
  await act(async () => {
    callbacks.onSuccess();
    root.render(<Fixture />);
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  expect(document.querySelector("[role=dialog]")).toBeNull();
  expect(document.activeElement).toBe(
    container.querySelector("section[aria-label='Library content']"),
  );
});

test("failed cross-parent save leaves the picker and destination available for retry after source removal", async () => {
  await openPickerAndMove();
  fixture.pending = false;
  await act(async () => root.render(<Fixture />));
  const dialog = document.querySelector("[role=dialog]");
  expect(dialog?.textContent).toContain("Move Source page");
  const destination = Array.from(
    dialog?.querySelectorAll<HTMLButtonElement>("button") ?? [],
  ).find((button) => button.textContent === "Recipes");
  expect(destination?.disabled).toBe(false);
  await act(async () => destination?.click());
  expect(fixture.move).toHaveBeenCalledTimes(2);
  expect(fixture.move.mock.calls[1]?.[0]).toEqual({
    destination: { parent_node_id: "destination", position: "after" },
    node_id: "source",
  });
});
