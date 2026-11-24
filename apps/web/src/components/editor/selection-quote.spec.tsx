// @vitest-environment jsdom

import { createDocumentEditor } from "@acme/better-editor/engine/editor";
import { TextSelection } from "@tiptap/pm/state";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { SelectionQuoteAction } from "./selection-quote";

const fixture = vi.hoisted(() => ({
  draft: "",
  setDraft: vi.fn((value: string) => {
    fixture.draft = value;
  }),
}));
vi.mock("~/components/chat/chat-presentation", () => ({
  useComposerDraft: () => ({
    draft: fixture.draft,
    setDraft: fixture.setDraft,
  }),
}));

let host: HTMLDivElement;
let root: Root;
let editor: ReturnType<typeof createDocumentEditor>;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fixture.draft = "";
  fixture.setDraft.mockClear();
  editor = createDocumentEditor({
    element: document.createElement("div"),
    extensions: [],
    initialBlocks: [{ content: "Text", id: "a", type: "paragraph" }],
    resolveUrl: async () => ({ items: [] }),
  });
  document.body.append(editor.view.dom);
  editor.view.focus();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  const dom = editor.view.dom;
  await act(async () => root.unmount());
  editor.destroy();
  dom.remove();
  host.remove();
  vi.unstubAllGlobals();
});

/** The block wrapper shifts text positions: "Text" occupies 2..6 in the doc. */
function select(positions: { from: number; to: number }) {
  editor.view.dispatch(
    editor.state.tr.setSelection(
      TextSelection.create(editor.state.doc, positions.from, positions.to),
    ),
  );
}

function affordance() {
  return document.querySelector<HTMLElement>("[data-selection-quote]");
}

/** React's controlled input ignores direct value writes; use the native
 * setter before dispatching the input event. */
async function typeIntoComment(value: string) {
  await act(async () => {
    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="Comment (optional)"]',
    );
    if (!input) throw new Error("Missing comment field");
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Real pointer sequence without jsdom's click() focus steal, matching how
 * the affordance keeps editor focus via prevented mousedown. */
async function press(element?: HTMLElement | null) {
  await act(async () => {
    element?.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

test("selection shows the floating trigger; quoting reaches the chat draft, Escape dismisses", async () => {
  await act(async () => root.render(<SelectionQuoteAction editor={editor} />));
  // No selection yet: nothing floats and the composer stays untouched.
  expect(affordance()).toBeNull();

  await act(async () => select({ from: 3, to: 5 }));
  const trigger = affordance();
  expect(trigger?.getAttribute("aria-label")).toBe("Quote to assistant");

  // Escape dismisses the affordance and returns focus to the editor.
  await act(async () => {
    trigger?.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    );
  });
  expect(affordance()).toBeNull();
  expect(document.activeElement).toBe(editor.view.dom);

  // A new selection brings it back.
  await act(async () => select({ from: 3, to: 5 }));
  expect(affordance()).not.toBeNull();

  // The popover opens with the quote, an optional comment, Cancel and Save.
  await press(affordance());
  const dialog = affordance();
  expect(dialog?.getAttribute("role")).toBe("dialog");
  expect(dialog?.textContent).toContain("ex");
  const comment = document.querySelector<HTMLInputElement>(
    'input[aria-label="Comment (optional)"]',
  );
  expect(comment).not.toBeNull();
  expect(document.activeElement).toBe(comment);
  await typeIntoComment("Check this");
  await press(
    document.querySelector<HTMLButtonElement>('button[aria-label="Save"]'),
  );
  // The quote and comment land in the chat draft; the affordance is done.
  expect(fixture.setDraft).toHaveBeenCalledExactlyOnceWith("> ex\nCheck this");
  expect(affordance()).toBeNull();
});

test("quotes append to an existing draft instead of replacing it", async () => {
  fixture.draft = "Earlier question";
  await act(async () => root.render(<SelectionQuoteAction editor={editor} />));
  await act(async () => select({ from: 2, to: 6 }));
  await press(affordance());
  await press(
    document.querySelector<HTMLButtonElement>('button[aria-label="Save"]'),
  );
  expect(fixture.setDraft).toHaveBeenCalledExactlyOnceWith(
    "Earlier question\n> Text",
  );
});

test("collapsing the selection or cancelling leaves the draft untouched", async () => {
  await act(async () => root.render(<SelectionQuoteAction editor={editor} />));
  await act(async () => select({ from: 3, to: 5 }));
  await press(affordance());
  await press(
    document.querySelector<HTMLButtonElement>('button[aria-label="Cancel"]'),
  );
  // Cancel returns to the trigger without quoting.
  expect(fixture.setDraft).not.toHaveBeenCalled();
  expect(affordance()?.getAttribute("aria-label")).toBe("Quote to assistant");

  await act(async () => select({ from: 3, to: 3 }));
  expect(affordance()).toBeNull();
  expect(fixture.setDraft).not.toHaveBeenCalled();
});
