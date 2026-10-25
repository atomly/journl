// @vitest-environment jsdom

import { Editor } from "@tiptap/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { documentExtensions } from "../engine/schema";
import { toTiptapDocument } from "../serialization/tiptap";
import { useHandleVisibility } from "./handle-visibility";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    addEventListener() {},
    matches: false,
    removeEventListener() {},
  }));
});
afterEach(() => vi.unstubAllGlobals());

test("pointer focus can enter editor controls without unmounting the pending click target", async () => {
  const surface = document.createElement("div");
  const host = document.createElement("div");
  const outside = document.createElement("button");
  document.body.append(surface, host, outside);
  const editor = new Editor({
    content: toTiptapDocument([{ id: "text", type: "paragraph" }]).toJSON(),
    element: surface,
    extensions: documentExtensions(),
  });
  const root = createRoot(host);
  function Handles() {
    const visible = useHandleVisibility(editor);
    return visible ? (
      <div data-tiptap-controls="" data-tiptap-owner={editor.instanceId}>
        <button type="button">Row actions</button>
      </div>
    ) : null;
  }
  try {
    await act(async () => root.render(<Handles />));
    await act(async () => editor.view.focus());
    const handle = host.querySelector("button");
    await act(async () => handle?.focus());
    expect(document.activeElement).toBe(handle);
    expect(handle?.isConnected).toBe(true);
    await act(async () => editor.view.focus());
    await act(async () => outside.focus());
    expect(host.querySelector("button")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    editor.destroy();
    surface.remove();
    host.remove();
    outside.remove();
  }
});

test("touch controls persist; desktop typing hides and interactions restore them", async () => {
  const surface = document.createElement("div");
  const host = document.createElement("div");
  document.body.append(surface, host);
  const editor = new Editor({
    content: toTiptapDocument([{ id: "text", type: "paragraph" }]).toJSON(),
    element: surface,
    extensions: documentExtensions(),
  });
  const root = createRoot(host);
  function Handles() {
    return <output>{String(useHandleVisibility(editor))}</output>;
  }
  const pointer = (type: string, pointerType: string) => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperties(event, {
      clientX: { value: 100 },
      clientY: { value: 100 },
      pointerType: { value: pointerType },
    });
    editor.view.dom.dispatchEvent(event);
  };
  vi.stubGlobal("matchMedia", () => ({
    addEventListener() {},
    matches: true,
    removeEventListener() {},
  }));
  try {
    await act(async () => root.render(<Handles />));
    await act(async () => pointer("pointerdown", "touch"));
    await act(async () => window.dispatchEvent(new Event("scroll")));
    expect(host.textContent).toBe("true");
    await act(async () =>
      editor.view.dom.dispatchEvent(
        new InputEvent("beforeinput", { bubbles: true }),
      ),
    );
    expect(host.textContent).toBe("true");
    await act(async () => window.dispatchEvent(new Event("scroll")));
    await act(async () => pointer("pointermove", "touch"));
    expect(host.textContent).toBe("true");
    await act(async () => pointer("pointerdown", "touch"));
    expect(host.textContent).toBe("true");
    await act(async () =>
      document.body.dispatchEvent(new Event("focusin", { bubbles: true })),
    );
    expect(host.textContent).toBe("true");
    await act(async () => pointer("pointermove", "mouse"));
    await act(async () =>
      editor.view.dom.dispatchEvent(
        new InputEvent("beforeinput", { bubbles: true }),
      ),
    );
    expect(host.textContent).toBe("false");
    await act(async () => pointer("pointerdown", "mouse"));
    await act(async () => window.dispatchEvent(new Event("scroll")));
    expect(host.textContent).toBe("true");
  } finally {
    await act(async () => root.unmount());
    editor.destroy();
    surface.remove();
    host.remove();
    vi.unstubAllGlobals();
  }
});

test("keyboard navigation and input in owned controls keep the focused control mounted", async () => {
  const surface = document.createElement("div");
  const host = document.createElement("div");
  const outside = document.createElement("input");
  document.body.append(surface, host, outside);
  const editor = new Editor({
    content: toTiptapDocument([{ id: "text", type: "paragraph" }]).toJSON(),
    element: surface,
    extensions: documentExtensions(),
  });
  const root = createRoot(host);
  function Handles() {
    return useHandleVisibility(editor) ? (
      <div data-tiptap-controls="" data-tiptap-owner={editor.instanceId}>
        <input aria-label="Editor control" />
      </div>
    ) : null;
  }
  try {
    await act(async () => root.render(<Handles />));
    const control = host.querySelector("input");
    await act(async () => control?.focus());
    await act(async () =>
      control?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }),
      ),
    );
    await act(async () =>
      control?.dispatchEvent(new InputEvent("beforeinput", { bubbles: true })),
    );
    expect(control?.isConnected).toBe(true);
    expect(document.activeElement).toBe(control);
    await act(async () => outside.focus());
    expect(host.querySelector("input")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    editor.destroy();
    surface.remove();
    host.remove();
    outside.remove();
  }
});
