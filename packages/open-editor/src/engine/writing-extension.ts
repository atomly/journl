import { Extension, InputRule, markInputRule } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { indentBlock, selectedBlock, toggleTextMark } from "./commands";
import { blockAt, type IdFactory, splitBlock } from "./identity";
import { changeBlockType, moveSelectedBlock, turnInto } from "./writing";

const lists = new Set([
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
]);

/** Writing-specific keys run before generic split/join, without handling IME input. */
export function writingExtension(createId: IdFactory) {
  return Extension.create({
    addInputRules() {
      const blockRule = (
        find: RegExp,
        type: Parameters<typeof changeBlockType>[1],
        props: (
          match: RegExpMatchArray,
        ) => Record<string, unknown> = () => ({}),
      ) =>
        new InputRule({
          find,
          handler: ({ state, range, match }) => {
            const target = selectedBlock(state);
            if (
              !target ||
              target.node.firstChild !== state.selection.$from.parent ||
              !state.selection.$from.parent.isTextblock ||
              state.selection.$from.parent.type.spec.code ||
              state.selection.$from.parent.content.size !==
                range.to - range.from
            )
              return null;
            const tr = state.tr;
            tr.delete(range.from, range.to);
            if (!turnInto(tr, target.id, type, props(match))) return null;
            if (type === "divider") {
              const wrapper = state.schema.nodes.openEditorBlock;
              const paragraph = state.schema.nodes.paragraph;
              if (!wrapper || !paragraph) return null;
              const block = blockAt(tr.doc, target.id);
              const pos = block.pos + block.node.nodeSize;
              tr.insert(
                pos,
                wrapper.createChecked({ id: createId() }, paragraph.create()),
              );
              tr.setSelection(TextSelection.create(tr.doc, pos + 2));
            }
          },
        });
      const marks = [
        ["bold", /(?:^|\s)(\*\*([^*]+)\*\*)$/],
        ["italic", /(?:^|\s)(_([^_]+)_)$/],
        ["strike", /(?:^|\s)(~~([^~]+)~~)$/],
        ["code", /(?:^|\s)(`([^`]+)`)$/],
      ] as const;
      return [
        blockRule(/^(#{1,6})\s$/, "heading", (match) => ({
          level: match[1]?.length ?? 1,
        })),
        blockRule(/^[-*+]\s$/, "bulletListItem"),
        blockRule(/^(\d+)\.\s$/, "numberedListItem", (match) => ({
          start: Number(match[1]),
        })),
        blockRule(/^\[([ xX])\]\s$/, "checkListItem", (match) => ({
          checked: match[1]?.toLowerCase() === "x",
        })),
        blockRule(/^>\s$/, "quote"),
        blockRule(/^```([\w-]*)\s$/, "codeBlock", (match) => ({
          language: match[1] || "auto",
        })),
        blockRule(/^---$/, "divider"),
        ...marks.flatMap(([name, find]) => {
          const type = this.editor.schema.marks[name];
          return type ? [markInputRule({ find, type })] : [];
        }),
      ];
    },
    addKeyboardShortcuts() {
      const run = (
        command: () => import("@tiptap/pm/state").Transaction | null,
      ) => {
        if (this.editor.view.composing) return false;
        const tr = command();
        if (!tr) return false;
        this.editor.view.dispatch(tr.scrollIntoView());
        return true;
      };
      const type =
        (
          name: Parameters<typeof changeBlockType>[1],
          props?: Record<string, unknown>,
        ) =>
        () =>
          run(() => changeBlockType(this.editor.state, name, props));
      const tab = (backward: boolean) => {
        const { state, view } = this.editor;
        if (view.composing) return false;
        const parent = state.selection.$from.parent;
        if (parent.type.name === "codeBlock") {
          if (!backward) view.dispatch(state.tr.insertText("\t"));
          else {
            const offset = state.selection.$from.parentOffset;
            const line =
              parent.textContent.slice(0, offset).lastIndexOf("\n") + 1;
            const prefix = parent.textContent.slice(line, offset);
            const length = prefix.startsWith("\t")
              ? 1
              : prefix.startsWith("  ")
                ? 2
                : 0;
            if (length)
              view.dispatch(
                state.tr.delete(
                  state.selection.$from.start() + line,
                  state.selection.$from.start() + line + length,
                ),
              );
          }
          return true;
        }
        return false;
      };
      return {
        "Mod-Alt-0": type("paragraph"),
        "Mod-e": () => run(() => toggleTextMark(this.editor.state, "code")),
        "Mod-Shift-s": () =>
          run(() => toggleTextMark(this.editor.state, "strike")),
        ...Object.fromEntries(
          [1, 2, 3, 4, 5, 6].map((level) => [
            `Mod-Alt-${level}`,
            type("heading", { level }),
          ]),
        ),
        Backspace: () => {
          if (this.editor.view.composing) return false;
          if (this.editor.commands.undoInputRule()) return true;
          const { state } = this.editor;
          const target = selectedBlock(state);
          const body = target?.node.firstChild;
          if (
            !target ||
            !body ||
            !state.selection.empty ||
            state.selection.$from.parentOffset
          )
            return false;
          if (lists.has(body.type.name))
            return run(() =>
              target.parentId
                ? indentBlock(state, true)
                : changeBlockType(state, "paragraph"),
            );
          if (body.type.name === "heading" || body.type.name === "quote")
            return run(() => changeBlockType(state, "paragraph"));
          return false;
        },
        Enter: () => {
          const { state, view } = this.editor;
          if (view.composing) return false;
          const target = selectedBlock(state);
          const body = target?.node.firstChild;
          if (!target || !body) return false;
          if (
            !state.selection.empty ||
            !state.selection.$from.sameParent(state.selection.$to)
          )
            return false;
          if (lists.has(body.type.name) && !body.content.size)
            return run(() =>
              target.parentId
                ? indentBlock(state, true)
                : changeBlockType(state, "paragraph"),
            );
          if (
            !lists.has(body.type.name) &&
            !(
              body.type.name === "heading" &&
              state.selection.$from.parentOffset === body.content.size
            )
          )
            return false;
          const tr = splitBlock(
            state.tr,
            target.id,
            state.selection.$from.parentOffset,
            createId,
          );
          const right = selectedBlock(tr);
          if (right && body.type.name === "heading")
            turnInto(tr, right.id, "paragraph");
          else if (right?.node.firstChild) {
            const props = { ...right.node.firstChild.attrs.props };
            if (body.type.name === "checkListItem") props.checked = false;
            if (body.type.name === "numberedListItem")
              props.start = Number(body.attrs.props?.start ?? 1) + 1;
            const current = blockAt(tr.doc, right.id);
            tr.setNodeMarkup(current.pos + 1, undefined, { props });
          }
          view.dispatch(tr.scrollIntoView());
          return true;
        },
        "Mod-Alt-q": type("quote"),
        "Mod-Shift-6": type("toggleListItem"),
        "Mod-Shift-7": type("numberedListItem"),
        "Mod-Shift-8": type("bulletListItem"),
        "Mod-Shift-9": type("checkListItem"),
        "Mod-Shift-ArrowDown": () =>
          run(() => moveSelectedBlock(this.editor.state, 1)),
        "Mod-Shift-ArrowUp": () =>
          run(() => moveSelectedBlock(this.editor.state, -1)),
        "Shift-Tab": () => tab(true),
        Tab: () => tab(false),
      };
    },
    name: "open-editor-writing",
    priority: 1050,
  });
}
