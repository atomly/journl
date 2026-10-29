import { Extension } from "@tiptap/core";
import { dropCursor } from "@tiptap/pm/dropcursor";
/** Optional drag feedback, independent of reference presentation. */
export const dropCursorExtension = Extension.create<{
  color: string;
  width: number;
}>({
  addOptions() {
    return { color: "currentColor", width: 1 };
  },
  addProseMirrorPlugins() {
    return [dropCursor(this.options)];
  },
  name: "better-editor-drop-cursor",
});
