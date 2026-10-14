import type { DbTransaction } from "@acme/db/client";
import { beforeEach, expect, test, vi } from "vitest";
import { queueFolderDeletionCleanup } from "~/workflows/folder-deletion-queue";

const fixture = vi.hoisted(() => ({
  claim: vi.fn(),
  job: {
    dispatched_at: "2026-10-13T12:00:00Z",
    id: "job-1",
    payload: { documentIds: ["document"], folderIds: [], subtreeNodeIds: [] },
    user_id: "owner",
  },
  jobs: vi.fn(),
  release: vi.fn(),
  start: vi.fn(),
}));
vi.mock("@acme/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ orderBy: () => ({ limit: () => fixture.jobs() }) }),
      }),
    }),
    update: () => ({
      set: (value: { dispatched_at: unknown }) => ({
        where: () =>
          value.dispatched_at === null
            ? fixture.release()
            : { returning: () => fixture.claim() },
      }),
    }),
  },
}));
vi.mock("~/workflows/folder-content-deletion", () => ({
  startFolderContentDeletion: fixture.start,
}));

import {
  dispatchFolderDeletionCleanup,
  recoverFolderDeletionOutbox,
} from "~/workflows/folder-deletion-outbox";

beforeEach(() => {
  vi.clearAllMocks();
  fixture.claim.mockResolvedValue([fixture.job]);
  fixture.release.mockResolvedValue(undefined);
  fixture.start.mockResolvedValue(undefined);
  fixture.jobs.mockResolvedValue([{ id: fixture.job.id }]);
});

test("enqueue failure leaves a recoverable job and does not turn committed deletion into an error", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  fixture.start.mockRejectedValueOnce(new Error("Queue unavailable"));
  await expect(
    dispatchFolderDeletionCleanup(fixture.job.id),
  ).resolves.toBeUndefined();
  expect(fixture.release).toHaveBeenCalledOnce();
  await recoverFolderDeletionOutbox("owner");
  expect(fixture.start).toHaveBeenCalledTimes(2);
  expect(fixture.start).toHaveBeenLastCalledWith({
    ...fixture.job.payload,
    jobId: fixture.job.id,
    userId: "owner",
  });
  log.mockRestore();
});

test("a claimed job is not dispatched twice by concurrent recovery", async () => {
  fixture.claim.mockResolvedValueOnce([fixture.job]).mockResolvedValueOnce([]);
  await Promise.all([
    dispatchFolderDeletionCleanup(fixture.job.id),
    dispatchFolderDeletionCleanup(fixture.job.id),
  ]);
  expect(fixture.start).toHaveBeenCalledOnce();
});

test("persistence failures abort deletion before dispatch", async () => {
  const returning = vi.fn().mockRejectedValue(new Error("DB unavailable"));
  const tx = {
    insert: () => ({ values: () => ({ returning }) }),
  } as unknown as DbTransaction;
  await expect(
    queueFolderDeletionCleanup(tx, fixture.job.payload, "owner"),
  ).rejects.toThrow("DB unavailable");
  expect(fixture.start).not.toHaveBeenCalled();
});

test("empty folders do not need a cleanup job", async () => {
  const insert = vi.fn();
  const tx = { insert } as unknown as DbTransaction;
  await expect(
    queueFolderDeletionCleanup(
      tx,
      { documentIds: [], folderIds: [], subtreeNodeIds: [] },
      "owner",
    ),
  ).resolves.toBeNull();
  expect(insert).not.toHaveBeenCalled();
});
