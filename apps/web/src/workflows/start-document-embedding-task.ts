import { start } from "workflow/api";

import { onDocumentEmbeddingTask } from "./on-document-embedding-task";

export async function startDocumentEmbeddingTaskWorkflow(input: {
  taskId: string;
  taskUpdatedAt: string;
}) {
  await start(onDocumentEmbeddingTask, [input]);
}
