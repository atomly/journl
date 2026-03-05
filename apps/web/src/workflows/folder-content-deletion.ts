import { and, eq, inArray } from "@acme/db";
import { Document, Folder, TreeNode } from "@acme/db/schema";
import { start } from "workflow/api";
import { z } from "zod/v4";

import { createTransaction } from "./utils/transaction";

const zFolderContentDeletionInput = z.object({
  documentIds: z.array(z.uuid()),
  folderIds: z.array(z.uuid()),
  subtreeNodeIds: z.array(z.uuid()),
  userId: z.string().min(1),
});

type FolderContentDeletionInput = z.infer<typeof zFolderContentDeletionInput>;

export async function startFolderContentDeletion(
  input: FolderContentDeletionInput,
) {
  await start(runFolderContentDeletion, [input]);
}

type FolderContentDeletionResult = {
  deletedDocuments: number;
  deletedFolders: number;
  deletedTreeNodes: number;
  success: true;
};

export async function runFolderContentDeletion(
  input: FolderContentDeletionInput,
): Promise<FolderContentDeletionResult> {
  "use workflow";

  const payload = await validateInput(input);

  const { deletedDocuments } = await deleteDocuments({
    documentIds: payload.documentIds,
    userId: payload.userId,
  });

  const { deletedFolders } = await deleteFolders({
    folderIds: payload.folderIds,
    userId: payload.userId,
  });

  const { deletedTreeNodes } = await deleteTreeNodes({
    subtreeNodeIds: payload.subtreeNodeIds,
    userId: payload.userId,
  });

  return {
    deletedDocuments,
    deletedFolders,
    deletedTreeNodes,
    success: true,
  };
}

async function validateInput(
  input: FolderContentDeletionInput,
): Promise<FolderContentDeletionInput> {
  "use step";

  return zFolderContentDeletionInput.parse(input);
}

async function deleteDocuments(input: {
  documentIds: string[];
  userId: string;
}): Promise<{ deletedDocuments: number }> {
  "use step";

  if (input.documentIds.length === 0) {
    return { deletedDocuments: 0 };
  }

  return await createTransaction(async (tx) => {
    const deleted = await tx
      .delete(Document)
      .where(
        and(
          eq(Document.user_id, input.userId),
          inArray(Document.id, input.documentIds),
        ),
      )
      .returning({ id: Document.id });

    return { deletedDocuments: deleted.length };
  });
}
deleteDocuments.maxRetries = 3;

async function deleteFolders(input: {
  folderIds: string[];
  userId: string;
}): Promise<{ deletedFolders: number }> {
  "use step";

  if (input.folderIds.length === 0) {
    return { deletedFolders: 0 };
  }

  return await createTransaction(async (tx) => {
    const deleted = await tx
      .delete(Folder)
      .where(
        and(
          eq(Folder.user_id, input.userId),
          inArray(Folder.id, input.folderIds),
        ),
      )
      .returning({ id: Folder.id });

    return { deletedFolders: deleted.length };
  });
}
deleteFolders.maxRetries = 3;

async function deleteTreeNodes(input: {
  subtreeNodeIds: string[];
  userId: string;
}): Promise<{ deletedTreeNodes: number }> {
  "use step";

  if (input.subtreeNodeIds.length === 0) {
    return { deletedTreeNodes: 0 };
  }

  return await createTransaction(async (tx) => {
    const deleted = await tx
      .delete(TreeNode)
      .where(
        and(
          eq(TreeNode.user_id, input.userId),
          inArray(TreeNode.id, input.subtreeNodeIds),
        ),
      )
      .returning({ id: TreeNode.id });

    return { deletedTreeNodes: deleted.length };
  });
}
deleteTreeNodes.maxRetries = 3;
