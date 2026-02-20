import { start } from "workflow/api";

import { onDocumentEmbeddingTask } from "./on-document-embedding-task";

export async function startDocumentEmbeddingWorkflow(input: {
  documentId: string;
  documentUpdatedAt: string;
  userId: string;
}) {
  await start(onDocumentEmbeddingTask, [input]);
}
