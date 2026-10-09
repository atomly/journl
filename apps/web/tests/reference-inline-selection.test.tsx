// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { schema } from "@acme/blocknote/schema";
import { BlockNoteEditor, FormattingToolbarExtension } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/shadcn";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { ReferenceSelectionExtension } from "../src/components/editor/reference-selection";

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing fixture");
  return value;
}

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.unstubAllGlobals();
});
async function setup() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const props = {
    targetKind: "external" as const,
    url: "https://github.com/atomly/journl/pull/302",
  };
  const editor = BlockNoteEditor.create({
    extensions: [ReferenceSelectionExtension()],
    initialContent: [
      {
        content: [
          { styles: {}, text: "Before ", type: "text" },
          { props, type: "contentReference" },
          { styles: {}, text: " after", type: "text" },
        ],
        id: "first",
        type: "paragraph",
      },
      { id: "card", props, type: "referenceCard" },
      {
        content: [
          { styles: {}, text: "Last ", type: "text" },
          { props, type: "contentReference" },
          { styles: {}, text: " end", type: "text" },
        ],
        id: "last",
        type: "paragraph",
      },
    ],
    schema,
  });
  const container = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = readFileSync("src/app/styles/blocknote.css", "utf8");
  document.head.append(style);
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <BlockNoteView
        editor={editor}
        formattingToolbar={false}
        slashMenu={false}
        sideMenu={false}
      />,
    ),
  );
  const positions: number[] = [];
  editor.prosemirrorView.state.doc.descendants((node, pos) => {
    if (node.type.name === "contentReference") positions.push(pos);
  });
  cleanups.push(async () => {
    await act(async () => root.unmount());
    container.remove();
    style.remove();
  });
  return { container, editor, positions };
}
function selectedBadges(container: HTMLElement) {
  return [
    ...container.querySelectorAll(
      "[data-reference-selected='true'] .content-reference",
    ),
  ];
}

test("native multi-block text selection outlines both inline badges and the intervening card", async () => {
  const { editor, container, positions } = await setup();
  const view = editor.prosemirrorView;
  await act(async () => {
    editor.focus();
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(
          view.state.doc,
          required(positions[0]),
          required(positions[1]) + 1,
        ),
      ),
    );
  });
  expect(selectedBadges(container)).toHaveLength(2);
  expect(view.state.selection).toBeInstanceOf(TextSelection);
  await act(async () =>
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(
          view.state.doc,
          required(positions[1]) + 1,
          required(positions[0]),
        ),
      ),
    ),
  );
  expect(view.state.selection.anchor).toBe(required(positions[1]) + 1);
  expect(view.state.selection.head).toBe(required(positions[0]));
  expect(selectedBadges(container)).toHaveLength(2);
  const badge = required(selectedBadges(container)[0]);
  expect(getComputedStyle(badge).outline).toContain("2px");
  expect(
    container
      .querySelector("[data-content-type='referenceCard']")
      ?.parentElement?.getAttribute("data-reference-selected"),
  ).toBe("true");
  const editorControl = document.createElement("button");
  container.querySelector(".bn-root")?.append(editorControl);
  await act(async () => editorControl.focus());
  expect(getComputedStyle(badge).outline).toContain("2px");
  editorControl.remove();
  const outside = document.createElement("button");
  document.body.append(outside);
  await act(async () => outside.focus());
  expect(getComputedStyle(badge).outline).not.toContain("2px");
  outside.remove();
  await act(async () => editor.setTextCursorPosition("last"));
  expect(selectedBadges(container)).toHaveLength(0);
});

test("selecting one inline atom gives only its native selection outline and collapsing removes it", async () => {
  const { editor, container, positions } = await setup();
  const view = editor.prosemirrorView;
  await act(async () => {
    editor.focus();
    view.dispatch(
      view.state.tr.setSelection(
        NodeSelection.create(view.state.doc, required(positions[0])),
      ),
    );
  });
  expect(selectedBadges(container)).toHaveLength(1);
  expect(
    getComputedStyle(required(selectedBadges(container)[0])).outline,
  ).toContain("2px");
  await act(async () =>
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, required(positions[0]) + 1),
      ),
    ),
  );
  expect(selectedBadges(container)).toHaveLength(0);
});

test("an exact badge-only text selection becomes a native node selection with formatting actions", async () => {
  const { editor, container, positions } = await setup();
  const view = editor.prosemirrorView;
  await act(async () => {
    editor.focus();
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(
          view.state.doc,
          required(positions[0]),
          required(positions[0]) + 1,
        ),
      ),
    );
  });
  expect(view.state.selection).toBeInstanceOf(NodeSelection);
  expect(editor.getExtension(FormattingToolbarExtension)?.store.state).toBe(
    true,
  );
  expect(selectedBadges(container)).toHaveLength(1);
  await act(async () => editor.setTextCursorPosition("first", "start"));
  expect(view.state.selection).toBeInstanceOf(TextSelection);
  expect(view.state.selection.empty).toBe(true);
  expect(editor.getExtension(FormattingToolbarExtension)?.store.state).toBe(
    false,
  );
});
