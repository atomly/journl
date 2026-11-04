// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { documentExtensions } from "../engine/schema";
import { createCodeBlockPresentation } from "./code-block";
import { EditorContent } from "./editor-content";
import { useBetterEditor } from "./use-better-editor";

const menu = vi.hoisted(() => ({
  current: undefined as
    | undefined
    | { disabled: boolean; onValueChange: (value: string) => void },
}));
vi.mock("@acme/ui/select", () => {
  const Pass = () => null;
  return {
    Select: (props: NonNullable<typeof menu.current>) => {
      menu.current = props;
      return null;
    },
    SelectContent: Pass,
    SelectItem: Pass,
    SelectTrigger: Pass,
    SelectValue: Pass,
  };
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
test("code language follows live readonly state and retained actions merge current node props", async () => {
  const presentation = createCodeBlockPresentation({
    languages: ["typescript", "javascript"],
  });
  const extensions = documentExtensions()
    .filter((extension) => extension.name === "codeBlock")
    .map((extension) => extension.extend(presentation));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let controller: ReturnType<typeof useBetterEditor> | undefined;
  function View() {
    controller = useBetterEditor({
      extensions,
      initialBlocks: [
        {
          content: "code",
          id: "code",
          props: { language: "typescript" },
          type: "codeBlock",
        },
      ],
    });
    return <EditorContent editor={controller.editor} />;
  }
  try {
    await act(async () => root.render(<View />));
    const editor = controller?.editor;
    if (!editor || !menu.current)
      throw new Error("Missing mounted language menu");
    const change = menu.current.onValueChange;
    expect(menu.current.disabled).toBe(false);
    await act(async () => editor.setEditable(false));
    expect(menu.current.disabled).toBe(true);
    const before = editor.state.doc;
    await act(async () => change("javascript"));
    expect(editor.state.doc).toBe(before);
    await act(async () => editor.setEditable(true));
    const body = editor.state.doc.nodeAt(1);
    await act(async () =>
      editor.view.dispatch(
        editor.state.tr.setNodeMarkup(1, undefined, {
          ...body?.attrs,
          props: { ...body?.attrs.props, language: "auto" },
        }),
      ),
    );
    expect(controller?.cause).toBeUndefined();
    expect(editor.isEditable).toBe(true);
    await act(async () => change("javascript"));
    expect(editor.state.doc.nodeAt(1)?.attrs.props).toMatchObject({
      language: "javascript",
    });
    await act(async () => editor.destroy());
    expect(() => change("typescript")).not.toThrow();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
