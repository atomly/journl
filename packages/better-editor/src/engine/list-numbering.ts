import { Extension } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

function nextOrdinal(body: Node | null, previous: number): number {
  return body?.type.name === "numberedListItem"
    ? (body.attrs.props?.start ?? previous + 1)
    : 0;
}

/** Explicit starts reset a run; omitted starts continue the preceding sibling. */
export function numberedListOrdinal(siblings: Node, index: number): number {
  let ordinal = 0;
  for (let i = 0; i <= index; i++)
    ordinal = nextOrdinal(siblings.child(i).firstChild, ordinal);
  return ordinal;
}

export const listNumberingKey = new PluginKey<DecorationSet>(
  "better-editor-list-numbering",
);

function numberLists(doc: Node): DecorationSet {
  const decorations: Decoration[] = [];
  const visit = (siblings: Node, start: number) => {
    let ordinal = 0;
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
