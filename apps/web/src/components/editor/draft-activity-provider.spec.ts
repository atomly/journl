import { expect, test, vi } from "vitest";
import { DocumentDraft } from "./document-draft";
import { DraftActivity } from "./draft-activity-provider";

function fixture() {
  const save = vi
    .fn()
    .mockResolvedValue({ document_id: "doc", updated_at: "v2" });
  const draft = new DocumentDraft(
    { blocks: undefined, documentId: "doc", updatedAt: "v1" },
    save,
    async () => ({ blocks: undefined, document_id: "doc", updated_at: "v1" }),
    () => {},
  );
  return { draft, save };
}

test("registered drafts keep publishing failures and recoveries after an editor leaves", async () => {
  const activity = new DraftActivity();
  const listener = vi.fn();
  const unsubscribe = activity.subscribe(listener);
  const { draft, save } = fixture();
  const entry = { draft, href: "/pages/1", key: "page:1", label: "Writing" };
  activity.register(entry);
  save.mockRejectedValueOnce(new Error("Offline"));
  draft.updateTitle("Keep my title", 60_000);
  expect(activity.getSnapshot()[0]?.draft.getSnapshot().isDirty).toBe(true);
  await draft.flush();
  expect(activity.getSnapshot()[0]?.draft.getSnapshot().error).toBeTruthy();
  const before = listener.mock.calls.length;
  // Re-registering on more keystrokes must not duplicate subscriptions.
  activity.register(entry);
  expect(listener).toHaveBeenCalledTimes(before);
  await draft.retry();
  expect(activity.getSnapshot()[0]?.draft.getSnapshot()).toMatchObject({
    error: null,
    isDirty: false,
  });
  unsubscribe();
});

test("replacing a clean retained document unsubscribes its previous instance", () => {
  const activity = new DraftActivity();
  const old = fixture().draft;
  const next = fixture().draft;
  const entry = { href: "/pages/1", key: "page:1", label: "Writing" };
  activity.register({ ...entry, draft: old });
  activity.register({ ...entry, draft: next });
  const listener = vi.fn();
  activity.subscribe(listener);
  old.updateTitle("Old", 60_000);
  expect(listener).not.toHaveBeenCalled();
  next.updateTitle("New", 60_000);
  expect(listener).toHaveBeenCalledOnce();
  // Clear timers without leaving a pending real save after the test.
  void old.flush();
  void next.flush();
});
