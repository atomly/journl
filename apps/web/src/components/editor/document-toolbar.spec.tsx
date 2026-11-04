// @vitest-environment jsdom
import { createDocumentEditor } from "@acme/better-editor/engine/editor";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { EditorToolbarItems } from "./document-toolbar";

const actions = vi.hoisted(() => new Map<string, (value: string) => void>());
const surfaces = vi.hoisted(() => ({
  children: ({
    children,
    render,
  }: {
    children?: ReactNode;
    render?: ReactNode;
  }) => render ?? children,
}));
vi.mock("@acme/better-editor/ui/controls", () => ({
  EditorHint: surfaces.children,
  EditorMenuItem: ({
    hint,
    onClick,
  }: {
    hint: string;
    onClick: () => void;
  }) => {
    actions.set(hint, onClick);
    return null;
  },
  EditorToolbarControl: surfaces.children,
  restoreEditorFocus: vi.fn(),
}));
vi.mock("@acme/ui/button", () => ({
  Button: ({
    "aria-label": label,
    onClick,
    disabled,
  }: {
    "aria-label": string;
    onClick?: () => void;
    disabled?: boolean;
  }) => {
    if (onClick) actions.set(label, onClick);
    return <button type="button" aria-label={label} disabled={disabled} />;
  },
}));
vi.mock("@base-ui/react/button", async () => ({
  Button: (await import("@acme/ui/button")).Button,
}));
vi.mock("@acme/ui/select", () => ({
  Select: ({
    onValueChange,
    children,
    disabled,
  }: {
    onValueChange: (value: string) => void;
    children: ReactNode;
    disabled: boolean;
  }) => {
    actions.set("Block type", onValueChange);
    return <fieldset disabled={disabled}>{children}</fieldset>;
  },
  SelectContent: surfaces.children,
  SelectGroup: surfaces.children,
  SelectItem: () => null,
  SelectTrigger: surfaces.children,
  SelectValue: () => null,
}));
vi.mock("@acme/ui/dropdown-menu", () => ({
  DropdownMenu: surfaces.children,
  DropdownMenuContent: surfaces.children,
  DropdownMenuGroup: surfaces.children,
  DropdownMenuTrigger: surfaces.children,
}));
vi.mock("@acme/ui/popover", () => ({
  Popover: surfaces.children,
  PopoverContent: surfaces.children,
  PopoverTrigger: surfaces.children,
}));
vi.mock("@acme/ui/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@acme/better-editor/ui/link-menu", () => ({ LinkMenu: () => null }));
vi.mock("@acme/better-editor/ui/mark-button", () => ({
  MarkButton: () => null,
}));
vi.mock("@acme/better-editor/ui/reference-display", () => ({
  ReferenceDisplayControl: () => null,
  ReferenceDisplayItems: () => null,
}));
vi.mock("./block-actions", () => ({ BlockActions: () => null }));
vi.mock("./table-menu", () => ({ DocumentTableMenu: () => null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test.each(["readonly", "destroyed"])(
  "retained app toolbar actions cannot mutate a %s editor",
  async (mode) => {
    const editor = createDocumentEditor({
      element: document.createElement("div"),
      extensions: [],
      initialBlocks: [{ content: "Text", id: "a", type: "paragraph" }],
      resolveUrl: async () => ({ items: [] }),
    });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const dispatch = vi.spyOn(editor.view, "dispatch");
    try {
      await act(async () =>
        root.render(
          <EditorToolbarItems
            editor={editor}
            insertReference={vi.fn()}
            linkOpen={false}
            onLinkOpenChange={vi.fn()}
          />,
        ),
      );
      const retained = [
        "Block type",
        "Align text center",
        "Text red",
        "Highlight blue",
        "Indent",
        "Outdent",
      ].map((label) => {
        const action = actions.get(label);
        expect(action, label).toBeTypeOf("function");
        return action;
      });
      expect(
        host.querySelector<HTMLButtonElement>(
          'button[aria-label="Text alignment"]',
        )?.disabled,
      ).toBe(false);
      expect(
        host.querySelector<HTMLButtonElement>('button[aria-label="Colors"]')
          ?.disabled,
      ).toBe(false);
      await act(async () => {
        if (mode === "readonly") editor.setEditable(false);
        else editor.destroy();
      });
      const before = editor.state.doc;
      dispatch.mockClear();
      const can = vi.spyOn(editor, "can");
      await act(async () => {
        for (const action of retained) action?.("Heading 1");
        root.render(
          <EditorToolbarItems
            editor={editor}
            insertReference={vi.fn()}
            linkOpen={false}
            onLinkOpenChange={vi.fn()}
          />,
        );
      });
      expect(editor.state.doc).toBe(before);
      expect(dispatch).not.toHaveBeenCalled();
      if (mode === "destroyed") expect(can).not.toHaveBeenCalled();
      expect(
        host.querySelector<HTMLButtonElement>(
          'button[aria-label="Text alignment"]',
        )?.disabled,
      ).toBe(true);
      expect(
        host.querySelector<HTMLButtonElement>('button[aria-label="Colors"]')
          ?.disabled,
      ).toBe(true);
      if (mode === "readonly") {
        await act(async () => editor.setEditable(true));
        await act(async () => retained[0]?.("Heading 1"));
        expect(editor.state.doc.firstChild?.firstChild?.type.name).toBe(
          "heading",
        );
      }
    } finally {
      await act(async () => root.unmount());
      editor.destroy();
      host.remove();
      actions.clear();
    }
  },
);
