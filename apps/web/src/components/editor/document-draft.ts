import type { EditorPartialBlock } from "@acme/blocknote/schema";
import type { BlockTransaction } from "~/trpc";

type SaveInput = {
  document_id: string | null;
  expected_updated_at: string | null;
  transactions: BlockTransaction[];
  title?: string;
};

type SavedDocument = { document_id: string; updated_at: string };
type WithBlocks<T> = T & { blocks: DraftInitial["blocks"] };
export type Save<T extends SavedDocument> = (input: SaveInput) => Promise<T>;

export type DraftInitial = {
  blocks: [EditorPartialBlock, ...EditorPartialBlock[]] | undefined;
  documentId: string | null;
  updatedAt: string | null;
  title?: string;
};

export type DraftRecoveryCopy = {
  id: string;
  createdAt: string;
  blocks: DraftInitial["blocks"];
  title?: string;
};

type DraftSnapshot = DraftInitial & {
  error: unknown;
  isDirty: boolean;
  isSaving: boolean;
  recoveryCopies: DraftRecoveryCopy[];
  conflict: boolean;
  resetKey: number;
};

type Batch = {
  input: SaveInput;
  blocks: DraftInitial["blocks"];
  title?: string;
};

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
export class DocumentDraft<T extends SavedDocument> {
  private snapshot: DraftSnapshot;
  private listeners = new Set<() => void>();
  private pending: BlockTransaction[] = [];
  private pendingTitle = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private saving = false;
  private failed: Batch | undefined;
  private onCreate: ((entry: WithBlocks<T>) => void) | undefined;

  constructor(
    initial: DraftInitial,
    private save: Save<T>,
    private load: () => Promise<WithBlocks<T> | { date: string }>,
    private onSaved: (entry: WithBlocks<T>) => void,
  ) {
    this.snapshot = {
      ...initial,
      conflict: false,
      error: null,
      isDirty: false,
      isSaving: false,
      recoveryCopies: [],
      resetKey: 0,
    };
  }

  canUseServerSnapshot(initial: DraftInitial) {
    return (
      !this.saving &&
      !this.failed &&
      this.pending.length === 0 &&
      !this.pendingTitle &&
      this.snapshot.recoveryCopies.length === 0 &&
      initial.updatedAt !== null &&
      (this.snapshot.updatedAt === null ||
        initial.updatedAt > this.snapshot.updatedAt)
    );
  }

  private isDirty = () =>
    this.saving ||
    Boolean(this.failed) ||
    this.pending.length > 0 ||
    this.pendingTitle;

  hasUnsavedChanges = () =>
    this.isDirty() || this.snapshot.recoveryCopies.length > 0;

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(snapshot: DraftSnapshot) {
    this.snapshot = { ...snapshot, isDirty: this.isDirty() };
    for (const listener of this.listeners) listener();
  }

  update(
    blocks: EditorPartialBlock[],
    transactions: BlockTransaction[],
    debounceTime: number,
    onCreate?: (entry: WithBlocks<T>) => void,
  ) {
    const [first, ...rest] = blocks;
    this.pending.push(...transactions);
    this.publish({
      ...this.snapshot,
      blocks: first ? [first, ...rest] : undefined,
    });
    this.onCreate = onCreate;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), debounceTime);
  }

  updateTitle(title: string, debounceTime: number) {
    this.pendingTitle = true;
    this.publish({ ...this.snapshot, title });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), debounceTime);
  }

  flush = async (): Promise<void> => {
    clearTimeout(this.timer);
    if (
      this.saving ||
      this.snapshot.error ||
      (this.pending.length === 0 && !this.pendingTitle)
    )
      return;

    const batch: Batch = {
      blocks: this.snapshot.blocks,
      input: {
        document_id: this.snapshot.documentId,
        expected_updated_at: this.snapshot.updatedAt,
        transactions: this.pending,
        ...(this.pendingTitle ? { title: this.snapshot.title } : {}),
      },
      title: this.snapshot.title,
    };
    this.pending = [];
    this.pendingTitle = false;
    await this.send(batch);
  };

  private accept(saved: T, batch: Batch) {
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
      this.publish({
        ...this.snapshot,
        conflict:
          (error as { data?: { code?: string } })?.data?.code === "CONFLICT",
        error,
      });
    } finally {
      this.saving = false;
      this.publish({ ...this.snapshot, isSaving: false });
    }

    // Drain edits made while saving, even if their editor has since unmounted.
    if ((this.pending.length > 0 || this.pendingTitle) && !this.snapshot.error)
      await this.flush();
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
      if (
        "document_id" in remote &&
        sameBlocks(remote.blocks, batch.blocks) &&
        (batch.title === undefined ||
          ("title" in remote && remote.title === batch.title))
      ) {
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
            "A newer version was saved elsewhere. Your draft has been kept.",
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

  loadSaved = async (
    backedUpBlocks = this.snapshot.blocks,
    backedUpTitle = this.snapshot.title,
  ): Promise<void> => {
    if (this.saving) return;
    const blocks = backedUpBlocks;
    if (
      blocks !== this.snapshot.blocks ||
      backedUpTitle !== this.snapshot.title
    ) {
      this.publish({
        ...this.snapshot,
        error: new Error(
          "Your draft changed. Review it before keeping both versions.",
        ),
      });
      return;
    }
    this.saving = true;
    this.publish({ ...this.snapshot, isSaving: true });
    try {
      const recoveryCopy: DraftRecoveryCopy = {
        blocks: structuredClone(blocks),
        createdAt: new Date().toISOString(),
        id: crypto.randomUUID(),
        ...(backedUpTitle !== undefined ? { title: backedUpTitle } : {}),
      };
      const remote = await this.load();
      if (
        blocks !== this.snapshot.blocks ||
        backedUpTitle !== this.snapshot.title
      )
        throw new Error(
          "Your draft changed while loading. Review it before keeping both versions.",
        );
      clearTimeout(this.timer);
      this.pending = [];
      this.pendingTitle = false;
      this.failed = undefined;
      this.publish({
        blocks: "blocks" in remote ? remote.blocks : undefined,
        conflict: false,
        documentId: "document_id" in remote ? remote.document_id : null,
        error: null,
        isDirty: false,
        isSaving: false,
        recoveryCopies: [...this.snapshot.recoveryCopies, recoveryCopy],
        resetKey: this.snapshot.resetKey + 1,
        title:
          "title" in remote && typeof remote.title === "string"
            ? remote.title
            : undefined,
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

  discardRecoveryCopy = (id: string) => {
    this.publish({
      ...this.snapshot,
      recoveryCopies: this.snapshot.recoveryCopies.filter(
        (copy) => copy.id !== id,
      ),
    });
  };
}
