import { expect, test, vi } from "vitest";
import { DocumentDraft } from "./document-draft";
import { DraftSessions } from "./draft-sessions";

test("draft memory survives layout scopes and reconnect retries guarded writes", async () => {
  const sessions = new DraftSessions();
  const session = sessions.get("owner");
  sessions.activate("owner");
  const save = vi.fn().mockRejectedValue(new Error("offline"));
  const draft = new DocumentDraft(
    { blocks: undefined, documentId: "doc", updatedAt: "v1" },
    save,
    async () => ({ blocks: undefined, document_id: "doc", updated_at: "v1" }),
    vi.fn(),
  );
  session.activity.register({
    draft,
    href: "/pages/page",
    key: "page",
    label: "Page",
  });
  draft.updateTitle("Pending title", 60_000);
  await draft.flush();
  expect(sessions.get("owner")).toBe(session);
  expect(sessions.hasUnsavedChanges()).toBe(true);
  save.mockResolvedValue({ document_id: "doc", updated_at: "v2" });
  sessions.resume();
  await vi.waitFor(() => expect(draft.getSnapshot().isDirty).toBe(false));
  expect(save.mock.calls[1]?.[0]).toMatchObject({
    expected_updated_at: "v1",
    title: "Pending title",
  });
  sessions.activate("another-owner");
  expect(sessions.getSnapshot()?.activity.getSnapshot()).toEqual([]);
  expect(sessions.get("owner")).not.toBe(session);
});
