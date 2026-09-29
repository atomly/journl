import type { PartialBlock } from "@blocknote/core";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  type DraftInitial,
  JournalEntryDraft,
} from "../src/app/(app)/journal/_components/journal-entry-draft";
import type { BlockTransaction } from "../src/trpc";

const date = "2026-09-29";
const documentId = "b196fb5d-6e49-4fe6-8184-85165f595097";
const blockId = "ed75f698-e625-49c8-97aa-5a00b3e3247c";
type Save = ConstructorParameters<typeof JournalEntryDraft>[2];
const v1 = "2026-09-29T12:00:00.000001Z";
const v2 = "2026-09-29T12:00:00.000002Z";
const v3 = "2026-09-29T12:00:00.000003Z";
const saved = {
  created_at: v1,
  date,
  document_id: documentId,
  id: "3c469dbd-6b5c-4cbd-ac7d-9481849bd0ce",
  updated_at: v2,
  user_id: "user",
};
const load = vi.fn<ConstructorParameters<typeof JournalEntryDraft>[3]>();
const onSaved = vi.fn();

function blocks(text: string): [PartialBlock] {
  return [{ content: text, id: blockId, type: "paragraph" }];
}

function transaction(text: string): BlockTransaction {
  return {
    args: {
      data: { content: text, props: {}, type: "paragraph" },
      id: blockId,
      parent_id: null,
    },
    type: "block_upsert",
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

beforeEach(() => {
  vi.useFakeTimers();
  load
    .mockReset()
    .mockResolvedValue({ ...saved, blocks: blocks("old"), updated_at: v1 });
  onSaved.mockClear();
});
afterEach(() => vi.useRealTimers());

test("restores the latest blocks when a row remounts before its debounce expires", async () => {
  const save = vi.fn<Save>().mockResolvedValue(saved);
  const draft = new JournalEntryDraft(
    date,
    { blocks: blocks("old"), documentId, updatedAt: v1 },
    save,
    load,
    onSaved,
  );
  const unmount = draft.subscribe(vi.fn());

  draft.update(blocks("latest"), [transaction("latest")], 150);
  unmount();
  expect(save).not.toHaveBeenCalled();

  // A remount uses the retained snapshot, even while the server still has old content.
  expect(draft.getSnapshot().blocks).toEqual(blocks("latest"));
  await vi.advanceTimersByTimeAsync(150);
  expect(save).toHaveBeenCalledExactlyOnceWith({
    date,
    document_id: documentId,
    expected_updated_at: v1,
    transactions: [transaction("latest")],
  });
  expect(draft.getSnapshot().blocks).toEqual(blocks("latest"));
});

test("unmount flushes the debounce without sending the batch twice", async () => {
  const save = vi.fn<Save>().mockResolvedValue(saved);
  const draft = new JournalEntryDraft(
    date,
    { blocks: undefined, documentId, updatedAt: v1 },
    save,
    load,
    onSaved,
  );
  draft.update(blocks("latest"), [transaction("latest")], 150);

  await draft.flush();
  await vi.advanceTimersByTimeAsync(150);

  expect(save).toHaveBeenCalledTimes(1);
});

test("drains edits made during a save after the row unmounts", async () => {
  const firstSave = deferred<Awaited<ReturnType<Save>>>();
  const save = vi
    .fn<Save>()
    .mockReturnValueOnce(firstSave.promise)
    .mockResolvedValue(saved);
  const draft = new JournalEntryDraft(
    date,
    { blocks: blocks("old"), documentId, updatedAt: v1 },
    save,
    load,
    onSaved,
  );
  draft.update(blocks("first"), [transaction("first")], 150);
  await vi.advanceTimersByTimeAsync(150);

  draft.update(blocks("second"), [transaction("second")], 150);
  await draft.flush(); // Virtualized row unmounts while the first request is pending.
  await vi.advanceTimersByTimeAsync(150);
  expect(save).toHaveBeenCalledTimes(1);

  firstSave.resolve(saved);
  await vi.advanceTimersByTimeAsync(0);
  expect(save).toHaveBeenNthCalledWith(2, {
    date,
    document_id: documentId,
    expected_updated_at: v2,
    transactions: [transaction("second")],
  });
  expect(draft.getSnapshot().blocks).toEqual(blocks("second"));
});

test("uses the created document ID and keeps newer text when creation completes", async () => {
  const creation = deferred<Awaited<ReturnType<Save>>>();
  const save = vi
    .fn<Save>()
    .mockReturnValueOnce(creation.promise)
    .mockResolvedValue(saved);
  const onCreate = vi.fn();
  const draft = new JournalEntryDraft(
    date,
    { blocks: undefined, documentId: null, updatedAt: null },
    save,
    load,
    onSaved,
  );
  draft.update(blocks("first"), [transaction("first")], 150, onCreate);
  await vi.advanceTimersByTimeAsync(150);
  draft.update(blocks("newer"), [transaction("newer")], 150, onCreate);

  const created = saved;
  creation.resolve(created);
  await vi.advanceTimersByTimeAsync(0);

  expect(save).toHaveBeenNthCalledWith(1, {
    date,
    document_id: null,
    expected_updated_at: null,
    transactions: [transaction("first")],
  });
  expect(save).toHaveBeenNthCalledWith(2, {
    date,
    document_id: documentId,
    expected_updated_at: v2,
    transactions: [transaction("newer")],
  });
  expect(onCreate).toHaveBeenCalledExactlyOnceWith({
    ...created,
    blocks: blocks("first"),
  });
  expect(draft.getSnapshot().documentId).toBe(documentId);
});

test("coalesces rapid edits in order and never sends an empty save", async () => {
  const save = vi.fn<Save>().mockResolvedValue(saved);
  const draft = new JournalEntryDraft(
    date,
    { blocks: undefined, documentId, updatedAt: v1 },
    save,
    load,
    onSaved,
  );
  await draft.flush();
  expect(save).not.toHaveBeenCalled();

  draft.update(blocks("a"), [transaction("a")], 150);
  await vi.advanceTimersByTimeAsync(100);
  draft.update(blocks("ab"), [transaction("ab")], 150);
  await vi.advanceTimersByTimeAsync(100);
  expect(save).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(50);
  expect(save).toHaveBeenCalledExactlyOnceWith({
    date,
    document_id: documentId,
    expected_updated_at: v1,
    transactions: [transaction("a"), transaction("ab")],
  });
});

test("different dates save independently", async () => {
  const slowSave = deferred<Awaited<ReturnType<Save>>>();
  const save = vi
    .fn<Save>()
    .mockReturnValueOnce(slowSave.promise)
    .mockResolvedValue(saved);
  const first = new JournalEntryDraft(
    date,
    { blocks: undefined, documentId, updatedAt: v1 },
    save,
    load,
    onSaved,
  );
  const second = new JournalEntryDraft(
    "2026-09-28",
    { blocks: undefined, documentId: "another-document", updatedAt: v1 },
    save,
    load,
    onSaved,
  );
  first.update(blocks("first"), [transaction("first")], 150);
  second.update(blocks("second"), [transaction("second")], 150);

  await vi.advanceTimersByTimeAsync(150);
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1]?.[0].date).toBe("2026-09-28");
  slowSave.resolve(saved);
  await vi.advanceTimersByTimeAsync(0);
});

test("keeps the local text and exposes save errors without advancing the queue", async () => {
  const error = new Error("Save failed");
  const save = vi.fn<Save>().mockRejectedValue(error);
  const draft = new JournalEntryDraft(
    date,
    { blocks: undefined, documentId, updatedAt: v1 },
    save,
    load,
    onSaved,
  );
  draft.update(blocks("unsaved text"), [transaction("unsaved text")], 150);

  await vi.advanceTimersByTimeAsync(150);
  expect(draft.getSnapshot().blocks).toEqual(blocks("unsaved text"));
  expect(draft.getSnapshot().error).toBe(error);
  await draft.flush();
  expect(save).toHaveBeenCalledTimes(1);
});

function setupRetry(
  initial: DraftInitial = { blocks: blocks("old"), documentId, updatedAt: v1 },
) {
  const save = vi
    .fn<Save>()
    .mockRejectedValueOnce(new Error("Network failure"))
    .mockResolvedValue(saved);
  const draft = new JournalEntryDraft(date, initial, save, load, onSaved);
  draft.update(blocks("first"), [transaction("first")], 150);
  return { draft, save };
}

test("retries a rolled-back batch with its original version and drains subsequent edits", async () => {
  const { draft, save } = setupRetry();
  await draft.flush();
  draft.update(blocks("second"), [transaction("second")], 150);
  await draft.retry();

  expect(save.mock.calls[1]).toEqual(save.mock.calls[0]);
  expect(save.mock.calls[2]?.[0]).toMatchObject({
    expected_updated_at: v2,
    transactions: [transaction("second")],
  });
  expect(draft.getSnapshot()).toMatchObject({
    blocks: blocks("second"),
    error: null,
    isSaving: false,
  });
});

test("recognizes a committed save whose response was lost, without replaying edges", async () => {
  const { draft, save } = setupRetry();
  await draft.flush();
  load.mockResolvedValue({ ...saved, blocks: blocks("first") });
  await draft.retry();

  expect(save).toHaveBeenCalledTimes(1);
  expect(draft.getSnapshot()).toMatchObject({ error: null, updatedAt: v2 });
  expect(onSaved).toHaveBeenCalledWith({ ...saved, blocks: blocks("first") });
});

test("reconciles lost creation responses before saving newer local edits", async () => {
  const { draft, save } = setupRetry({
    blocks: blocks(""),
    documentId: null,
    updatedAt: null,
  });
  await draft.flush();
  draft.update(blocks("second"), [transaction("second")], 150);
  load.mockResolvedValue({ ...saved, blocks: blocks("first") });
  await draft.retry();

  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1]?.[0]).toMatchObject({
    document_id: documentId,
    expected_updated_at: v2,
    transactions: [transaction("second")],
  });
});

test("preserves local text instead of overwriting a conflicting remote update", async () => {
  const { draft, save } = setupRetry();
  await draft.flush();
  load.mockResolvedValue({
    ...saved,
    blocks: blocks("remote"),
    updated_at: v3,
  });
  await draft.retry();

  expect(save).toHaveBeenCalledTimes(1);
  expect(draft.getSnapshot()).toMatchObject({
    blocks: blocks("first"),
    conflict: true,
  });
});

test("a second network failure leaves the draft available for another retry", async () => {
  const { draft, save } = setupRetry();
  await draft.flush();
  load.mockRejectedValueOnce(new Error("Still offline"));
  await draft.retry();
  expect(save).toHaveBeenCalledTimes(1);
  expect(draft.getSnapshot().isSaving).toBe(false);
  await draft.retry();
  expect(save).toHaveBeenCalledTimes(2);
  expect(draft.getSnapshot().error).toBeNull();
});

test("clean drafts accept newer server versions but ignore stale cached versions", async () => {
  const save = vi.fn<Save>().mockResolvedValue(saved);
  const draft = new JournalEntryDraft(
    date,
    { blocks: blocks("old"), documentId, updatedAt: v1 },
    save,
    load,
    onSaved,
  );
  draft.update(blocks("local"), [transaction("local")], 150);
  const fresh = { blocks: blocks("remote"), documentId, updatedAt: v3 };
  expect(draft.canUseServerSnapshot(fresh)).toBe(false);
  await draft.flush();
  expect(draft.canUseServerSnapshot(fresh)).toBe(true);
  expect(draft.canUseServerSnapshot({ ...fresh, updatedAt: v1 })).toBe(false);
});

test("failed drafts are protected from fresh server snapshots", async () => {
  const { draft } = setupRetry();
  await draft.flush();
  expect(
    draft.canUseServerSnapshot({
      blocks: blocks("remote"),
      documentId,
      updatedAt: v3,
    }),
  ).toBe(false);
});

test("explicit recovery loads the saved entry and clears failed transactions", async () => {
  const { draft, save } = setupRetry();
  await draft.flush();
  load.mockResolvedValue({
    ...saved,
    blocks: blocks("remote"),
    updated_at: v3,
  });
  await draft.loadSaved();
  expect(draft.getSnapshot()).toMatchObject({
    blocks: blocks("remote"),
    error: null,
    resetKey: 1,
    updatedAt: v3,
  });
  await draft.flush();
  expect(save).toHaveBeenCalledTimes(1);
});

test("recovery does not discard text typed while the saved entry loads", async () => {
  const { draft } = setupRetry();
  await draft.flush();
  const loading = deferred<Awaited<ReturnType<typeof load>>>();
  load.mockReturnValueOnce(loading.promise);
  const recovery = draft.loadSaved();
  draft.update(blocks("keep this"), [transaction("keep this")], 150);
  loading.resolve({ ...saved, blocks: blocks("remote"), updated_at: v3 });
  await recovery;
  expect(draft.getSnapshot().blocks).toEqual(blocks("keep this"));
  expect(draft.getSnapshot().resetKey).toBe(0);
});

test("recovery does not discard text typed while the backup was downloading", async () => {
  const { draft } = setupRetry();
  await draft.flush();
  const backedUp = draft.getSnapshot().blocks;
  draft.update(
    blocks("typed during download"),
    [transaction("typed during download")],
    150,
  );
  await draft.loadSaved(backedUp);
  expect(load).not.toHaveBeenCalled();
  expect(draft.getSnapshot().blocks).toEqual(blocks("typed during download"));
});
