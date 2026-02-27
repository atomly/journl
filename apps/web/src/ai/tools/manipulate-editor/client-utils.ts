import type { EditorPrimitive } from "@acme/blocknote/schema";

export function isElementPartiallyInViewport(element: Element) {
  const rect = element.getBoundingClientRect();
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth;
  return (
    rect.top < viewportHeight &&
    rect.bottom > 0 &&
    rect.left < viewportWidth &&
    rect.right > 0
  );
}

export function resolveAIMenuBlockId(editor: EditorPrimitive) {
  const selectedBlockId = editor.getSelection()?.blocks.at(-1)?.id;
  if (selectedBlockId) {
    return selectedBlockId;
  }

  const cursorBlockId = editor.getTextCursorPosition().block.id;
  if (cursorBlockId) {
    return cursorBlockId;
  }

  return editor.document.at(0)?.id;
}
