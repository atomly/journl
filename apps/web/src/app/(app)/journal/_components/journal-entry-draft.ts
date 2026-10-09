import type { EditorPartialBlock } from "@acme/blocknote/schema";
import type { BlockTransaction, JournalListEntry } from "~/trpc";

type SaveInput = {
  date: string;
  document_id: string | null;
  expected_updated_at: string | null;
  transactions: BlockTransaction[];
};

type CreatedEntry = Extract<JournalListEntry, { document_id: string }>;
type Save = (input: SaveInput) => Promise<Omit<CreatedEntry, "blocks">>;

export type DraftInitial = {
  blocks: [EditorPartialBlock, ...EditorPartialBlock[]] | undefined;
  documentId: string | null;
  updatedAt: string | null;
};

type DraftSnapshot = DraftInitial & {
  error: unknown;
  isSaving: boolean;
  conflict: boolean;
  resetKey: number;
};

type Batch = { input: SaveInput; blocks: DraftInitial["blocks"] };

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonical(child)]),
    );
  }
  return value;
}

function sameBlocks(a: DraftInitial["blocks"], b: DraftInitial["blocks"]) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/** Owns the draft and save queue independently of a virtualized editor's lifetime. */
export class JournalEntryDraft {
  private snapshot: DraftSnapshot;
  private listeners = new Set<() => void>();
  private pending: BlockTransaction[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private saving = false;
  private failed: Batch | undefined;
  private onCreate: ((entry: JournalListEntry) => void) | undefined;

  constructor(
    private date: string,
    initial: DraftInitial,
    private save: Save,
    private load: () => Promise<JournalListEntry>,
    private onSaved: (entry: CreatedEntry) => void,
  ) {
    this.snapshot = {
      ...initial,
      conflict: false,
      error: null,
      isSaving: false,
      resetKey: 0,
    };
  }

  canUseServerSnapshot(initial: DraftInitial) {
    return (
      !this.saving &&
      !this.failed &&
      this.pending.length === 0 &&
      initial.updatedAt !== null &&
      (this.snapshot.updatedAt === null ||
        initial.updatedAt > this.snapshot.updatedAt)
    );
  }

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(snapshot: DraftSnapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }

  update(
    blocks: EditorPartialBlock[],
    transactions: BlockTransaction[],
    debounceTime: number,
    onCreate?: (entry: JournalListEntry) => void,
  ) {
    const [first, ...rest] = blocks;
    this.publish({
      ...this.snapshot,
      blocks: first ? [first, ...rest] : undefined,
    });
    this.pending.push(...transactions);
    this.onCreate = onCreate;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), debounceTime);
  }

  flush = async (): Promise<void> => {
    clearTimeout(this.timer);
    if (this.saving || this.snapshot.error || this.pending.length === 0) return;

    const batch: Batch = {
      blocks: this.snapshot.blocks,
      input: {
        date: this.date,
        document_id: this.snapshot.documentId,
        expected_updated_at: this.snapshot.updatedAt,
        transactions: this.pending,
      },
    };
    this.pending = [];
    await this.send(batch);
  };

  private accept(saved: Omit<CreatedEntry, "blocks">, batch: Batch) {
    const isNew = !this.snapshot.documentId;
    this.failed = undefined;
    this.publish({
      ...this.snapshot,
      conflict: false,
      documentId: saved.document_id,
      error: null,
      updatedAt: saved.updated_at,
    });
    this.onSaved({ ...saved, blocks: batch.blocks });
    if (isNew) this.onCreate?.({ ...saved, blocks: batch.blocks });
  }

  private async send(batch: Batch) {
    this.saving = true;
    this.publish({ ...this.snapshot, error: null, isSaving: true });
    try {
      const saved = await this.save(batch.input);
      this.accept(saved, batch);
    } catch (error) {
      this.failed = batch;
      this.publish({ ...this.snapshot, error });
    } finally {
      this.saving = false;
      this.publish({ ...this.snapshot, isSaving: false });
    }

    // Drain edits made while saving, even if their editor has since unmounted.
    if (this.pending.length > 0 && !this.snapshot.error) await this.flush();
  }

  retry = async (): Promise<void> => {
    const batch = this.failed;
    if (!batch || this.saving) return;
    this.saving = true;
    this.publish({ ...this.snapshot, isSaving: true });
    let shouldResend = false;
    try {
      // A failed response does not prove the transaction rolled back.
      const remote = await this.load();
      if ("document_id" in remote && sameBlocks(remote.blocks, batch.blocks)) {
        this.accept(remote, batch);
      } else if (
        ("updated_at" in remote ? remote.updated_at : null) ===
        batch.input.expected_updated_at
      ) {
        shouldResend = true;
      } else {
        this.publish({
          ...this.snapshot,
          conflict: true,
          error: new Error(
            "A newer version of this entry was saved elsewhere. Your draft has been kept.",
          ),
        });
      }
    } catch (error) {
      this.publish({ ...this.snapshot, error });
    } finally {
      this.saving = false;
      this.publish({ ...this.snapshot, isSaving: false });
    }
    // Reuse the original version guard: an earlier request may still be running.
    if (shouldResend) await this.send(batch);
    else if (!this.snapshot.error) await this.flush();
  };

  loadSaved = async (backedUpBlocks = this.snapshot.blocks): Promise<void> => {
    if (this.saving) return;
    const blocks = backedUpBlocks;
    if (blocks !== this.snapshot.blocks) {
      this.publish({
        ...this.snapshot,
        error: new Error(
          "Your draft changed while downloading. Download it again before replacing it.",
        ),
      });
      return;
    }
    this.saving = true;
    this.publish({ ...this.snapshot, isSaving: true });
    try {
      const remote = await this.load();
      if (blocks !== this.snapshot.blocks)
        throw new Error(
          "Your draft changed while loading. Download it again before replacing it.",
        );
      clearTimeout(this.timer);
      this.pending = [];
      this.failed = undefined;
      this.publish({
        blocks: "blocks" in remote ? remote.blocks : undefined,
        conflict: false,
        documentId: "document_id" in remote ? remote.document_id : null,
        error: null,
        isSaving: false,
        resetKey: this.snapshot.resetKey + 1,
        updatedAt: "updated_at" in remote ? remote.updated_at : null,
      });
      if ("document_id" in remote) this.onSaved(remote);
    } catch (error) {
      this.publish({ ...this.snapshot, error });
    } finally {
      this.saving = false;
      this.publish({ ...this.snapshot, isSaving: false });
    }
  };
}
