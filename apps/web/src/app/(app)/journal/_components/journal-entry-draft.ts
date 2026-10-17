import { DocumentDraft } from "~/components/editor/document-draft";
import type { JournalListEntry } from "~/trpc";

export type { DraftInitial } from "~/components/editor/document-draft";

type SavedEntry = Omit<
  Extract<JournalListEntry, { document_id: string }>,
  "blocks"
>;
type DraftArgs = ConstructorParameters<typeof DocumentDraft<SavedEntry>>;

export class JournalEntryDraft extends DocumentDraft<SavedEntry> {
  constructor(
    date: string,
    initial: DraftArgs[0],
    save: (
      input: Parameters<DraftArgs[1]>[0] & { date: string },
    ) => ReturnType<DraftArgs[1]>,
    load: DraftArgs[2],
    onSaved: DraftArgs[3],
  ) {
    super(initial, (input) => save({ ...input, date }), load, onSaved);
  }
}
