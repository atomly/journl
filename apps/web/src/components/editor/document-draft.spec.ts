import { expect, test, vi } from "vitest";
import { DocumentDraft, type DraftInitial } from "./document-draft";

const initial = {
  blocks: undefined,
  documentId: "document",
  title: "Old title",
  updatedAt: "v1",
};
const saved = { document_id: "document", title: "New title", updated_at: "v2" };

function fixture() {
  const save = vi.fn().mockResolvedValue(saved);
  const load = vi.fn().mockResolvedValue({ ...saved, blocks: undefined });
  const onSaved = vi.fn();
  const draft = new DocumentDraft(initial, save, load, onSaved);
  return { draft, load, onSaved, save };
}

test("page titles and body changes share a versioned batch", async () => {
  const { draft, save } = fixture();
  draft.updateTitle("New title", 60_000);
  draft.update([], [{ args: { id: "block" }, type: "block_remove" }], 60_000);
  await draft.flush();
  expect(save).toHaveBeenCalledExactlyOnceWith({
    document_id: "document",
    expected_updated_at: "v1",
    title: "New title",
    transactions: [{ args: { id: "block" }, type: "block_remove" }],
  });
  expect(draft.hasUnsavedChanges()).toBe(false);
});

test("a failed title keeps the draft dirty and retry recognizes a lost response", async () => {
  const { draft, save } = fixture();
  save.mockRejectedValueOnce(new Error("Response lost"));
  draft.updateTitle("New title", 60_000);
  await draft.flush();
  expect(draft.hasUnsavedChanges()).toBe(true);
  await draft.retry();
  expect(save).toHaveBeenCalledTimes(1);
  expect(draft.getSnapshot()).toMatchObject({
    error: null,
    title: "New title",
    updatedAt: "v2",
  });
});

test("equal blocks do not reconcile a title that differs on the server", async () => {
  const { draft, save, load } = fixture();
  save.mockRejectedValueOnce(new Error("Response lost"));
  draft.updateTitle("New title", 60_000);
  await draft.flush();
  load.mockResolvedValue({ ...saved, blocks: undefined, title: "Elsewhere" });
  await draft.retry();
  expect(draft.getSnapshot()).toMatchObject({
    conflict: true,
    title: "New title",
  });
  expect(draft.hasUnsavedChanges()).toBe(true);
});

test("recovery never discards a title changed during download or loading", async () => {
  const { draft, load } = fixture();
  draft.updateTitle("New title", 60_000);
  const backup = draft.getSnapshot();
  draft.updateTitle("Keep this", 60_000);
  await draft.loadSaved(backup.blocks, backup.title);
  expect(load).not.toHaveBeenCalled();
  let resolve!: (value: typeof saved & { blocks: undefined }) => void;
  load.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const loading = draft.loadSaved();
  draft.updateTitle("Keep this too", 60_000);
  resolve({ ...saved, blocks: undefined });
  await loading;
  expect(draft.getSnapshot()).toMatchObject({
    resetKey: 0,
    title: "Keep this too",
  });
  // Recovery errors stop the queue; flushing also clears the outstanding timer.
  await draft.flush();
});

test("reconciliation cannot rebase a pending title over a newer remote title", async () => {
  const { draft, save, load } = fixture();
  save.mockRejectedValueOnce(new Error("Response lost"));
  draft.update([], [{ args: { id: "block" }, type: "block_remove" }], 60_000);
  await draft.flush();
  draft.updateTitle("Pending local title", 60_000);
  load.mockResolvedValue({
    ...saved,
    blocks: undefined,
    title: "New remote title",
  });
  await draft.retry();
  expect(save).toHaveBeenCalledTimes(1);
  expect(draft.getSnapshot()).toMatchObject({
    conflict: true,
    title: "Pending local title",
  });
  await draft.flush();
});

test("keeping both retains complete independent rich content and title across recoveries", async () => {
  const { draft, load } = fixture();
  const blocks: NonNullable<DraftInitial["blocks"]> = [
    {
      children: [{ content: "Nested child", id: "nested", type: "paragraph" }],
      content: [
        {
          styles: { bold: true, italic: true },
          text: "Rich draft",
          type: "text",
        },
        {
          content: [
            { styles: { code: true }, text: "Reference", type: "text" },
          ],
          href: "https://example.invalid/reference",
          type: "link",
        },
      ],
      id: "rich-block",
      props: { backgroundColor: "yellow", textAlignment: "center" },
      type: "paragraph",
    },
  ];
  draft.update(blocks, [{ args: { id: "old" }, type: "block_remove" }], 60_000);
  draft.updateTitle("Complete local title", 60_000);
  const original = structuredClone(blocks);
  await draft.loadSaved();
  const [copy] = draft.getSnapshot().recoveryCopies;
  expect(copy).toMatchObject({
    blocks: original,
    title: "Complete local title",
  });
  expect(copy?.id).toEqual(expect.any(String));
  expect(Number.isNaN(Date.parse(copy?.createdAt ?? ""))).toBe(false);
  // Recovery is independent of editor objects and survives a full JSON export.
  blocks[0].props = { textAlignment: "right" };
  expect(JSON.parse(JSON.stringify(copy))).toMatchObject({ blocks: original });
  expect(draft.getSnapshot()).toMatchObject({
    blocks: undefined,
    isDirty: false,
    resetKey: 1,
    title: "New title",
  });
  expect(draft.hasUnsavedChanges()).toBe(true);
  expect(draft.canUseServerSnapshot({ ...initial, updatedAt: "v3" })).toBe(
    false,
  );

  draft.updateTitle("Another draft", 60_000);
  load.mockResolvedValue({ ...saved, blocks: undefined, updated_at: "v3" });
  await draft.loadSaved();
  expect(draft.getSnapshot().recoveryCopies).toHaveLength(2);
  expect(draft.getSnapshot().recoveryCopies[0]).toEqual(copy);
  expect(draft.getSnapshot().recoveryCopies[1]?.title).toBe("Another draft");

  draft.discardRecoveryCopy(copy?.id ?? "");
  const [remaining] = draft.getSnapshot().recoveryCopies;
  expect(remaining?.title).toBe("Another draft");
  draft.discardRecoveryCopy(remaining?.id ?? "");
  expect(draft.hasUnsavedChanges()).toBe(false);
  expect(draft.canUseServerSnapshot({ ...initial, updatedAt: "v4" })).toBe(
    true,
  );
});

test("failed loading keeps the active draft and does not create a recovery copy", async () => {
  const { draft, load } = fixture();
  draft.updateTitle("Keep me", 60_000);
  load.mockRejectedValue(new Error("Offline"));
  await draft.loadSaved();
  expect(draft.getSnapshot()).toMatchObject({
    isDirty: true,
    recoveryCopies: [],
    resetKey: 0,
    title: "Keep me",
  });
  await draft.flush();
});

test("recovery never replaces body edits made while loading", async () => {
  const { draft, load } = fixture();
  let resolve!: (value: typeof saved & { blocks: undefined }) => void;
  load.mockReturnValueOnce(new Promise((done) => (resolve = done)));
  const loading = draft.loadSaved();
  draft.update(
    [{ content: "Keep this text", id: "new-draft", type: "paragraph" }],
    [{ args: { id: "old" }, type: "block_remove" }],
    60_000,
  );
  resolve({ ...saved, blocks: undefined });
  await loading;
  expect(draft.getSnapshot()).toMatchObject({
    blocks: [{ content: "Keep this text", id: "new-draft" }],
    isDirty: true,
    recoveryCopies: [],
    resetKey: 0,
  });
  await draft.flush();
});

test("dirty status publishes immediately for body edits and remains dirty on failure", async () => {
  const { draft, save } = fixture();
  const statuses: boolean[] = [];
  draft.subscribe(() => statuses.push(draft.getSnapshot().isDirty));
  save.mockRejectedValue(new Error("Offline"));
  draft.update([], [{ args: { id: "old" }, type: "block_remove" }], 60_000);
  expect(statuses).toEqual([true]);
  await draft.flush();
  expect(statuses.every(Boolean)).toBe(true);
  expect(draft.getSnapshot()).toMatchObject({ isDirty: true, isSaving: false });
});

test("queued saves never briefly publish a saved status before the final batch", async () => {
  const { draft, save } = fixture();
  let resolve!: (value: typeof saved) => void;
  save.mockReturnValueOnce(new Promise((done) => (resolve = done)));
  const statuses: { isDirty: boolean; isSaving: boolean }[] = [];
  draft.subscribe(() => {
    const { isDirty, isSaving } = draft.getSnapshot();
    statuses.push({ isDirty, isSaving });
  });
  draft.updateTitle("First", 60_000);
  const saving = draft.flush();
  draft.updateTitle("Second", 60_000);
  resolve(saved);
  await saving;
  expect(save).toHaveBeenCalledTimes(2);
  expect(statuses.at(-1)).toEqual({ isDirty: false, isSaving: false });
  expect(
    statuses.slice(0, -1).every((status) => status.isDirty || status.isSaving),
  ).toBe(true);
});
