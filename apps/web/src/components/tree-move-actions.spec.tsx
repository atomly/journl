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
  TreeMoveDialog,
  TreeMoveMenuItems,
} from "~/components/tree-move-actions";

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
  ["Move up", "click"],
  ["Move down", "click"],
  ["Move to…", "click"],
  ["Move up", "Enter"],
  ["Move down", "Enter"],
  ["Move to…", "Enter"],
])("%s is available with %s", async (label, activation) => {
  const moveUp = vi.fn();
  const moveDown = vi.fn();
  const chooseFolder = vi.fn();
  await act(async () => {
    root.render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <TreeMoveMenuItems
            onMoveUp={moveUp}
            onMoveDown={moveDown}
            onChooseFolder={chooseFolder}
          />
        </DropdownMenuContent>
      </DropdownMenu>,
    );
  });
  await act(async () => container.querySelector("button")?.click());
  const item = Array.from(
    document.querySelectorAll<HTMLElement>("[role=menuitem]"),
  ).find((element) => element.textContent === label);
  expect(item).toBeDefined();
  await act(async () => {
    if (activation === "click") item?.click();
    else {
      item?.focus();
      item?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: activation }),
      );
      item?.dispatchEvent(
        new KeyboardEvent("keyup", { bubbles: true, key: activation }),
      );
    }
  });
  const actions = {
    "Move down": moveDown,
    "Move to…": chooseFolder,
    "Move up": moveUp,
  };
  expect(actions[label as keyof typeof actions]).toHaveBeenCalledOnce();
  expect(container.querySelector("button")?.getAttribute("aria-expanded")).toBe(
    "false",
  );
});

test("destination chooser prevents current/invalid destinations and supports moving to Library", async () => {
  const move = vi.fn();
  await act(async () => {
    root.render(
      <TreeMoveDialog
        open
        onOpenChange={vi.fn()}
        itemLabel="Source page"
        currentParentNodeId="current"
        destinations={[
          { label: "Library", nodeId: null },
          { label: "Recipes", nodeId: "current" },
          { disabled: true, label: "Invalid folder", nodeId: "invalid" },
          { label: "Desserts", nodeId: "other" },
        ]}
        onMove={move}
      />,
    );
  });
  expect(document.querySelector("[role=dialog]")?.textContent).toContain(
    "Move Source page",
  );
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  );
  const current = buttons.find((button) =>
    button.textContent?.includes("Recipes"),
  );
  const invalid = buttons.find(
    (button) => button.textContent === "Invalid folder",
  );
  expect(current?.disabled).toBe(true);
  expect(invalid?.disabled).toBe(true);
  await act(async () => {
    current?.click();
    invalid?.click();
  });
  expect(move).not.toHaveBeenCalled();
  await act(async () =>
    buttons.find((button) => button.textContent === "Library")?.click(),
  );
  expect(move).toHaveBeenCalledExactlyOnceWith(null);
});

test("destination search exposes matching folders and a useful empty state", async () => {
  await act(async () => {
    root.render(
      <TreeMoveDialog
        open
        onOpenChange={vi.fn()}
        itemLabel="Source page"
        currentParentNodeId={null}
        destinations={[
          { label: "Library", nodeId: null },
          { label: "Desserts", nodeId: "other" },
        ]}
        onMove={vi.fn()}
      />,
    );
  });
  const input = document.querySelector<HTMLInputElement>("input");
  expect(input).not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  await act(async () => {
    setter?.call(input, "dess");
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const list = document.querySelector("ul[aria-label='Move destinations']");
  expect(list?.textContent).toContain("Desserts");
  expect(list?.textContent).not.toContain("Library");
  await act(async () => {
    setter?.call(input, "not a folder");
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(list?.querySelector("[role=status]")?.textContent).toBe(
    "No matching destinations",
  );
});
