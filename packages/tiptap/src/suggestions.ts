import type { DocumentBlock } from "@acme/document";
import { Extension } from "@tiptap/core";
import {
  type EditorState,
  Plugin,
  PluginKey,
  TextSelection,
} from "@tiptap/pm/state";
import { selectedBlock } from "./commands";
import type { IdFactory } from "./identity";
import { turnInto } from "./writing";

export type BlockChoice = {
  title: string;
  aliases: string;
  type: DocumentBlock["type"];
  props?: Record<string, unknown>;
};
export const blockChoices: BlockChoice[] = [
  { aliases: "paragraph plain", title: "Text", type: "paragraph" },
  ...[1, 2, 3, 4, 5, 6].map((level) => ({
    aliases: `h${level} title`,
    props: { isToggleable: false, level },
    title: `Heading ${level}`,
    type: "heading" as const,
  })),
  { aliases: "unordered", title: "Bullet list", type: "bulletListItem" },
  { aliases: "ordered", title: "Numbered list", type: "numberedListItem" },
  {
    aliases: "todo task",
    props: { checked: false },
    title: "Checklist",
    type: "checkListItem",
  },
  { aliases: "collapse", title: "Toggle list", type: "toggleListItem" },
  {
    aliases: "collapse title",
    props: { isToggleable: true, level: 2 },
    title: "Toggle heading",
    type: "heading",
  },
  { aliases: "blockquote", title: "Quote", type: "quote" },
  {
    aliases: "source codeblock",
    props: { language: "text" },
    title: "Code",
    type: "codeBlock",
  },
  { aliases: "horizontal rule", title: "Divider", type: "divider" },
  { aliases: "grid rows columns", title: "Table", type: "table" },
];
export type SlashQuery = {
  from: number;
  to: number;
  query: string;
  index: number;
};
export const slashKey = new PluginKey<SlashQuery | null>("journlSlash");
export const filteredBlockChoices = (query: string) =>
  blockChoices.filter((choice) =>
    `${choice.title} ${choice.aliases}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
export function slashQuery(
  state: EditorState,
): Omit<SlashQuery, "index"> | null {
  const { selection } = state;
  if (
    !selection.empty ||
    !selection.$from.parent.isTextblock ||
    selection.$from.parent.type.name === "codeBlock" ||
    selection.$from.parent.type.name === "tableParagraph"
  )
    return null;
  const text = selection.$from.parent.textContent;
  if (selection.$from.parentOffset !== text.length) return null;
  const match = /^\/([^\n/]*)$/.exec(text);
  return match
    ? {
        from: selection.$from.start(),
        query: match[1] ?? "",
        to: selection.from,
      }
    : null;
}
export function applySlashChoice(
  state: EditorState,
  choice: BlockChoice,
  createId: IdFactory,
) {
  const query = slashQuery(state);
  const target = selectedBlock(state);
  if (!query || !target) return null;
  const tr = state.tr.delete(query.from, query.to);
  if (!turnInto(tr, target.id, choice.type, choice.props)) return null;
  if (choice.type === "divider") {
    const paragraph = state.schema.nodes.paragraph;
    const wrapper = state.schema.nodes.journlBlock;
    if (!paragraph || !wrapper) return null;
    const current = tr.doc.nodeAt(target.pos);
    if (!current) return null;
    const pos = target.pos + current.nodeSize;
    tr.insert(
      pos,
      wrapper.createChecked({ id: createId() }, paragraph.create()),
    );
    tr.setSelection(TextSelection.create(tr.doc, pos + 2));
  }
  return tr.scrollIntoView();
}
export function suggestionExtension(createId: IdFactory) {
  return Extension.create({
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [
        new Plugin<SlashQuery | null>({
          key: slashKey,
          props: {
            handleDOMEvents: {
              blur(view) {
                view.dispatch(
                  view.state.tr.setMeta(slashKey, { dismiss: true }),
                );
                return false;
              },
            },
            handleKeyDown(view, event) {
              if (
                !view.editable ||
                view.composing ||
                event.isComposing ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey
              )
                return false;
              const current = slashKey.getState(view.state);
              if (!current) return false;
              if (event.key === "Escape") {
                view.dispatch(
                  view.state.tr.setMeta(slashKey, { dismiss: true }),
                );
                return true;
              }
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                view.dispatch(
                  view.state.tr.setMeta(slashKey, {
                    direction: event.key === "ArrowDown" ? 1 : -1,
                  }),
                );
                return true;
              }
              if (event.key !== "Enter") return false;
              const choice = filteredBlockChoices(current.query)[current.index];
              const tr =
                choice && applySlashChoice(view.state, choice, createId);
              if (!tr) return false;
              view.dispatch(tr);
              return true;
            },
          },
          state: {
            apply(tr, previous, _, state) {
              if (!editor.isFocused) return null;
              const query = slashQuery(state);
              if (!query) return null;
              const meta = tr.getMeta(slashKey);
              if (meta?.dismiss) return null;
              // Escape stays dismissed until the document/selection changes.
              if (!previous && !tr.docChanged && !tr.selectionSet) return null;
              const same =
                previous?.from === query.from && previous.query === query.query;
              const count = filteredBlockChoices(query.query).length;
              return {
                ...query,
                index: count
                  ? ((same ? previous.index : 0) +
                      (meta?.direction ?? 0) +
                      count) %
                    count
                  : 0,
              };
            },
            init: () => null,
          },
        }),
      ];
    },
    name: "journlSuggestions",
    priority: 1100,
  });
}
