// @vitest-environment jsdom
import { Toolbar } from "@base-ui/react/toolbar";
import { Editor } from "@tiptap/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { toTiptapDocument } from "../serialization/tiptap";
import { testDocumentExtensions } from "../testing/extensions";
import { CommandButton } from "./command-button";
import { LinkMenu } from "./link-menu";
import { BoldButton } from "./mark-button";
import { useEditorEditable } from "./use-editor-editable";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
test("independent command controls disable on destruction and recover with a replacement editor", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const create = () =>
    new Editor({
      content: toTiptapDocument([{ id: "p", type: "paragraph" }]).toJSON(),
      element: document.createElement("div"),
      extensions: testDocumentExtensions(),
    });
  const first = create();
  const replacement = create();
  const run = vi.fn();
  const command = { run };
  function Controls({ editor }: { editor: Editor }) {
    return (
      <Toolbar.Root>
        <CommandButton editor={editor} command={command}>
          Run
        </CommandButton>
        <BoldButton editor={editor} />
      </Toolbar.Root>
    );
  }
  const disabled = () =>
    [...host.querySelectorAll("button")].map(
      (button) =>
        button.disabled || button.getAttribute("aria-disabled") === "true",
    );
  try {
    await act(async () => root.render(<Controls editor={first} />));
    expect(disabled()).toEqual([false, false]);
    await act(async () => first.setEditable(false));
    expect(disabled()).toEqual([true, true]);
    await act(async () => first.setEditable(true));
    expect(disabled()).toEqual([false, false]);
    await act(async () => first.destroy());
    expect(disabled()).toEqual([true, true]);
    await act(async () => host.querySelector("button")?.click());
    expect(run).not.toHaveBeenCalled();
    await act(async () => root.render(<Controls editor={replacement} />));
    expect(disabled()).toEqual([false, false]);
    await act(async () => host.querySelector("button")?.click());
    expect(run).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    first.destroy();
    replacement.destroy();
    host.remove();
  }
});
test("independent editability subscriptions observe destruction and editor replacement", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const create = () =>
    new Editor({
      content: toTiptapDocument([{ id: "p", type: "paragraph" }]).toJSON(),
      element: document.createElement("div"),
      extensions: testDocumentExtensions(),
    });
  const first = create();
  const second = create();
  function Status({ editor }: { editor: Editor }) {
    return (
      <output>{useEditorEditable(editor) ? "editable" : "readonly"}</output>
    );
  }
  try {
    await act(async () => root.render(<Status editor={first} />));
    expect(host.textContent).toBe("editable");
    await act(async () => first.destroy());
    expect(host.textContent).toBe("readonly");
    await act(async () => root.render(<Status editor={second} />));
    expect(host.textContent).toBe("editable");
    await act(async () => second.setEditable(false));
    expect(host.textContent).toBe("readonly");
    await act(async () => second.setEditable(true));
    expect(host.textContent).toBe("editable");
  } finally {
    await act(async () => root.unmount());
    first.destroy();
    second.destroy();
    host.remove();
  }
});

test("standalone link control disables after destruction and recovers with a new editor", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const create = () =>
    new Editor({
      content: toTiptapDocument([{ id: "p", type: "paragraph" }]).toJSON(),
      element: document.createElement("div"),
      extensions: testDocumentExtensions(),
    });
  const first = create();
  const second = create();
  const render = (editor: Editor) =>
    root.render(
      <Toolbar.Root>
        <LinkMenu editor={editor} />
      </Toolbar.Root>,
    );
  const disabled = () => {
    const button = host.querySelector("button");
    return button?.disabled || button?.getAttribute("aria-disabled") === "true";
  };
  try {
    await act(async () => render(first));
    expect(disabled()).toBe(false);
    await act(async () => first.destroy());
    expect(disabled()).toBe(true);
    await act(async () => host.querySelector("button")?.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => render(second));
    expect(disabled()).toBe(false);
  } finally {
    await act(async () => root.unmount());
    first.destroy();
    second.destroy();
    host.remove();
  }
});
