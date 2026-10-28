import { Extension } from "@tiptap/core";
import { Slice } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { normalizePastedLists } from "../serialization/html-paste";
import { markdownClipboard } from "../serialization/markdown-paste";
import type { IdFactory } from "./identity";

/** One paste boundary: rich HTML uses ProseMirror, plain structured text uses
 * CommonMark. Closing owned slices prevents the first list item losing its type
 * when ProseMirror fits the paste into an existing paragraph. */
export function clipboardPasteExtension(createId: IdFactory) {
  return Extension.create({
    addProseMirrorPlugins: () => [
      new Plugin({
        props: {
          clipboardTextParser: (text, context) =>
            markdownClipboard(text, context, createId),
          transformPasted: (slice, _view, plain) =>
            plain && slice.content.firstChild?.type.name === "openeditorBlock"
              ? new Slice(slice.content, 0, 0)
              : slice,
          transformPastedHTML: (html) => normalizePastedLists(html, createId),
        },
      }),
    ],
    name: "openeditorClipboardPaste",
  });
}
