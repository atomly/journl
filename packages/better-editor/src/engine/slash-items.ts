import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import {
  applySlashChoice,
  blockChoices,
  type SlashQuery,
  slashKey,
} from "./suggestions";

export type SlashMenuItem = {
  id: string;
  title: string;
  keywords?: string;
  group?: string;
  disabled?: boolean;
  run: (context: {
    editor: Editor;
    createId: () => string;
    range: { from: number; to: number };
    transaction: Transaction;
  }) => Transaction | null;
};
export type SlashItemSource =
  | readonly SlashMenuItem[]
  | ((
      query: string,
      context: { editor: Editor; signal: AbortSignal },
    ) => readonly SlashMenuItem[] | Promise<readonly SlashMenuItem[]>);
type Collection = {
  enabled?: boolean;
  items: readonly SlashMenuItem[];
  query?: string;
  from?: number;
  onError?: (error: unknown) => void;
};
const collections = new WeakMap<Editor, Collection>();
let defaults: readonly SlashMenuItem[] | undefined;
export function defaultSlashItems(): readonly SlashMenuItem[] {
  defaults ??= blockChoices.map((choice) => ({
    id: `${choice.type}:${choice.title}`,
    keywords: choice.aliases,
    run: ({ editor, createId }) =>
      applySlashChoice(editor.state, choice, createId),
    title: choice.title,
  }));
  return defaults;
}
export function slashMenuEnabled(editor: Editor) {
  return collections.get(editor)?.enabled ?? true;
}
export function matchingSlashItems(
  editor: Editor,
  query: Pick<SlashQuery, "query" | "from">,
): readonly SlashMenuItem[] {
  const collection = collections.get(editor);
  if (
    collection?.query !== undefined &&
    (collection.query !== query.query || collection.from !== query.from)
  )
    return [];
  if (collection?.query !== undefined) return collection.items;
  const items = collection?.items ?? defaultSlashItems();
  return items.filter((item) =>
    `${item.title} ${item.keywords ?? ""}`
      .toLowerCase()
      .includes(query.query.toLowerCase()),
  );
}
/** Configuration stays outside document state and applies only to this editor. */
export function setSlashItems(
  editor: Editor,
  collection: Collection | undefined,
) {
  if (editor.isDestroyed) return;
  if (collection) {
    const ids = new Set<string>();
    for (const item of collection.items) {
      if (!item.id || ids.has(item.id))
        throw new Error("Slash menu items require unique nonempty IDs");
      ids.add(item.id);
    }
    collections.set(editor, collection);
  } else collections.delete(editor);
  editor.view.dispatch(editor.state.tr.setMeta(slashKey, { refresh: true }));
}
export function executeSlashItem(
  editor: Editor,
  id: string,
  createId: () => string = () => crypto.randomUUID(),
) {
  const query = slashKey.getState(editor.state);
  const item = query?.items.find((candidate) => candidate.id === id);
  if (
    !query ||
    !item ||
    item.disabled ||
    !editor.isEditable ||
    editor.view.composing
  )
    return false;
  try {
    const transaction = item.run({
      createId,
      editor,
      range: query,
      transaction: editor.state.tr.delete(query.from, query.to),
    });
    if (!transaction) return false;
    editor.view.dispatch(
      transaction.setMeta(slashKey, { dismiss: true }).scrollIntoView(),
    );
    editor.view.focus();
    return true;
  } catch (error) {
    collections.get(editor)?.onError?.(error);
    return false;
  }
}
