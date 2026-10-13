import type { DbTransaction } from "@acme/db/client";
import {
  FolderDeletionOutbox,
  type FolderDeletionPayload,
} from "@acme/db/schema";

/** Call inside the same transaction that removes the folder from the tree. */
export async function queueFolderDeletionCleanup(
  tx: DbTransaction,
  payload: FolderDeletionPayload,
  userId: string,
) {
  if (
    !payload.documentIds.length &&
    !payload.folderIds.length &&
    !payload.subtreeNodeIds.length
  )
    return null;
  const [job] = await tx
    .insert(FolderDeletionOutbox)
    .values({ payload, user_id: userId })
    .returning({ id: FolderDeletionOutbox.id });
  if (!job) throw new Error("Could not persist folder deletion cleanup");
  return job.id;
}
