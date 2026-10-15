import { and, eq, lt, or, sql } from "@acme/db";
import { db } from "@acme/db/client";
import { FolderDeletionOutbox } from "@acme/db/schema";
import { startFolderContentDeletion } from "./folder-content-deletion";

const readyForDispatch = () =>
  or(
    sql`${FolderDeletionOutbox.dispatched_at} is null`,
    lt(FolderDeletionOutbox.dispatched_at, sql`now() - interval '15 minutes'`),
  );

/** Dispatch is best effort after commit. The durable job remains until completion. */
export async function dispatchFolderDeletionCleanup(jobId: string) {
  try {
    const [job] = await db
      .update(FolderDeletionOutbox)
      .set({ dispatched_at: sql`now()` })
      .where(and(eq(FolderDeletionOutbox.id, jobId), readyForDispatch()))
      .returning();
    if (!job?.dispatched_at) return;
    try {
      await startFolderContentDeletion({
        ...job.payload,
        jobId: job.id,
        userId: job.user_id,
      });
    } catch (error) {
      // Match the lease so an older failed dispatcher cannot clear a newer claim.
      await db
        .update(FolderDeletionOutbox)
        .set({ dispatched_at: null })
        .where(
          and(
            eq(FolderDeletionOutbox.id, job.id),
            eq(FolderDeletionOutbox.dispatched_at, job.dispatched_at),
          ),
        );
      console.error("Folder cleanup enqueue deferred to recovery", {
        error,
        jobId,
      });
    }
  } catch (error) {
    console.error("Folder cleanup dispatch deferred to recovery", {
      error,
      jobId,
    });
  }
}

export async function recoverFolderDeletionOutbox(userId?: string) {
  try {
    const jobs = await db
      .select({ id: FolderDeletionOutbox.id })
      .from(FolderDeletionOutbox)
      .where(
        and(
          readyForDispatch(),
          userId ? eq(FolderDeletionOutbox.user_id, userId) : undefined,
        ),
      )
      .orderBy(FolderDeletionOutbox.requested_at)
      .limit(userId ? 10 : 100);
    for (const job of jobs) await dispatchFolderDeletionCleanup(job.id);
  } catch (error) {
    console.error("Folder cleanup recovery deferred", { error });
  }
}
