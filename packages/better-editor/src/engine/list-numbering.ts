import { Extension } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

function nextOrdinal(
  body: Node | null,
  previous: number | null,
): number | null {
  if (body?.type.name !== "numberedListItem") return null;
  const props = body.attrs.props;
  // Older builds stored a fixed ordinal on every item. Only the start of
  // the run and an intentional restart should affect its displayed numbers.
  return previous === null || props?.restart
    ? (props?.start ?? 1)
    : previous + 1;
}

export const listNumberingKey = new PluginKey<DecorationSet>(
  "better-editor-list-numbering",
);

function numberLists(doc: Node): DecorationSet {
  const decorations: Decoration[] = [];
  const visit = (siblings: Node, start: number) => {
    let ordinal: number | null = null;
    siblings.forEach((block, offset) => {
      const body = block.firstChild;
      ordinal = nextOrdinal(body, ordinal);
      if (body?.type.name === "numberedListItem") {
        const pos = start + offset + 1;
        decorations.push(
          Decoration.node(pos, pos + body.nodeSize, {
            "data-start": String(ordinal),
          }),
        );
      }
      const children = block.lastChild;
      if (body && children?.type.name === "betterEditorChildren")
        visit(children, start + offset + body.nodeSize + 2);
    });
  };
  visit(doc, 0);
  return DecorationSet.create(doc, decorations);
}

/** Display ordinals without rewriting stored props, identities or undo history. */
export const listNumberingExtension = Extension.create({
  addProseMirrorPlugins: () => [
    new Plugin<DecorationSet>({
      key: listNumberingKey,
      props: { decorations: (state) => listNumberingKey.getState(state) },
      state: {
        apply: (tr, previous) =>
          tr.docChanged ? numberLists(tr.doc) : previous,
        init: (_, state) => numberLists(state.doc),
      },
    }),
  ],
  name: "better-editor-list-numbering",
});
