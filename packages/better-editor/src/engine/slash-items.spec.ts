// @vitest-environment jsdom
import { expect, test, vi } from "vitest";
import { createDocumentEditor } from "./editor";
import { executeSlashItem, setSlashItems } from "./slash-items";
import { slashKey } from "./suggestions";

test("a retained slash activation cannot invoke consumer code after destruction", () => {
  const element = document.createElement("div");
  document.body.append(element);
  const editor = createDocumentEditor({
    element,
    extensions: [],
    initialBlocks: [{ id: "p", type: "paragraph" }],
    resolveUrl: async () => ({ items: [] }),
  });
  const run = vi.fn(({ transaction }) => transaction.insertText("Changed"));
  try {
    setSlashItems(editor, {
      enabled: true,
      items: [{ id: "run", run, title: "Run" }],
    });
    editor.view.focus();
    editor.commands.insertContent("/r");
    expect(slashKey.getState(editor.state)?.items[0]?.id).toBe("run");
    editor.destroy();
    expect(executeSlashItem(editor, "run")).toBe(false);
    expect(run).not.toHaveBeenCalled();
  } finally {
    editor.destroy();
    element.remove();
  }
});
