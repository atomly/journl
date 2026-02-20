import { blocknoteBlocks, blocknoteMarkdown } from "@acme/blocknote/server";
import { and, eq, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Document,
  DocumentEmbedding,
  DocumentEmbeddingTask,
  type zInsertDocumentEmbedding,
} from "@acme/db/schema";
import { type ChunkParams, MDocument } from "@mastra/rag";
import { embedMany } from "ai";
import removeMarkdown from "remove-markdown";
import { FatalError, sleep } from "workflow";
import { start } from "workflow/api";
import { z } from "zod/v4";

import { model } from "~/ai/providers/openai/embedding";
import { onModelUsage } from "./on-model-usage";

const EMBEDDING_DEBOUNCE_DELAY = "2m";
const EMBEDDING_RETRY_DELAY = "5m";
const MAX_TASK_RETRIES = 3;

const CHUNK_PARAMS: ChunkParams = {
  strategy: "semantic-markdown",
};

const REMOVE_MARKDOWN_PARAMS: Parameters<typeof removeMarkdown>[1] = {
  gfm: true,
  listUnicodeChar: "",
  stripListLeaders: true,
  useImgAltText: true,
};

const zDocumentEmbeddingTaskEvent = z.object({
  taskId: z.uuid(),
  taskUpdatedAt: z.string().min(1),
});

type DocumentEmbeddingTaskEvent = z.infer<typeof zDocumentEmbeddingTaskEvent>;

type DocumentEmbeddingWorkflowResult = {
  reason?: string;
  status: "completed" | "skipped";
  taskId: string;
};

export async function onDocumentEmbeddingTask(
  event: DocumentEmbeddingTaskEvent,
): Promise<DocumentEmbeddingWorkflowResult> {
  "use workflow";

  const payload = await validateDocumentEmbeddingTaskEvent(event);

  await sleep(EMBEDDING_DEBOUNCE_DELAY);

  while (true) {
    const task = await prepareDocumentEmbeddingAttempt(payload);

    if (!task.shouldProcess) {
      return {
        reason: task.reason,
        status: "skipped",
        taskId: payload.taskId,
      };
    }

    try {
      const embeddingResult = await embedDocumentForTask({
        documentId: task.documentId,
        taskId: payload.taskId,
        userId: task.userId,
      });

      return {
        reason: embeddingResult.reason,
        status: "completed",
        taskId: payload.taskId,
      };
    } catch (error) {
      const retryState = await markTaskFailure({
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        taskId: payload.taskId,
        taskUpdatedAt: payload.taskUpdatedAt,
      });

      if (!retryState.shouldRetry) {
        throw new FatalError(retryState.reason);
      }

      await sleep(EMBEDDING_RETRY_DELAY);
    }
  }
}

async function validateDocumentEmbeddingTaskEvent(
  event: DocumentEmbeddingTaskEvent,
): Promise<DocumentEmbeddingTaskEvent> {
  "use step";

  return zDocumentEmbeddingTaskEvent.parse(event);
}

async function prepareDocumentEmbeddingAttempt(input: {
  taskId: string;
  taskUpdatedAt: string;
}): Promise<
  | { reason: string; shouldProcess: false }
  | { documentId: string; shouldProcess: true; userId: string }
> {
  "use step";

  const task = await db.query.DocumentEmbeddingTask.findFirst({
    columns: {
      document_id: true,
      retries: true,
      status: true,
      updated_at: true,
      user_id: true,
    },
    where: eq(DocumentEmbeddingTask.id, input.taskId),
  });

  if (!task) {
    return {
      reason: "Task no longer exists",
      shouldProcess: false,
    };
  }

  if (hasTaskBeenSuperseded(task.updated_at, input.taskUpdatedAt)) {
    return {
      reason: "Task was superseded by a newer update",
      shouldProcess: false,
    };
  }

  if (task.status === "completed") {
    return {
      reason: "Task already completed",
      shouldProcess: false,
    };
  }

  if (task.status === "ready") {
    return {
      reason: "Task is already being processed",
      shouldProcess: false,
    };
  }

  if (task.status === "failed" && task.retries >= MAX_TASK_RETRIES) {
    return {
      reason: "Task has exhausted retries",
      shouldProcess: false,
    };
  }

  await db
    .update(DocumentEmbeddingTask)
    .set({
      status: "ready",
    })
    .where(eq(DocumentEmbeddingTask.id, input.taskId));

  return {
    documentId: task.document_id,
    shouldProcess: true,
    userId: task.user_id,
  };
}

async function embedDocumentForTask(input: {
  documentId: string;
  taskId: string;
  userId: string;
}): Promise<{ reason?: string }> {
  "use step";

  const document = await db.query.Document.findFirst({
    where: and(
      eq(Document.id, input.documentId),
      eq(Document.user_id, input.userId),
    ),
    with: {
      block_edges: true,
      block_nodes: true,
    },
  });

  if (!document) {
    throw new Error("Document not found");
  }

  const blocks = blocknoteBlocks(document.block_nodes, document.block_edges);
  const markdown = blocks ? await blocknoteMarkdown(blocks) : "";

  if (!removeMarkdown(markdown, REMOVE_MARKDOWN_PARAMS)) {
    await markTaskCompleted(input.taskId, "The markdown is empty.");
    return {
      reason: "The markdown is empty.",
    };
  }

  const mDocument = MDocument.fromMarkdown(markdown);
  const chunks = await mDocument.chunk(CHUNK_PARAMS);

  const { embeddings, usage } = await embedMany({
    maxRetries: 5,
    model,
    values: chunks.map((chunk) => chunk.text),
  });

  await start(onModelUsage, [
    {
      metrics: [{ quantity: usage.tokens, unit: "tokens" }],
      modelId: model.modelId,
      modelProvider: model.provider,
      userId: input.userId,
    },
  ]);

  const insertions: z.infer<typeof zInsertDocumentEmbedding>[] = [];

  for (const [index, embedding] of embeddings.entries()) {
    const chunk = chunks.at(index);

    if (!chunk) {
      continue;
    }

    const chunkText = chunk.text;
    const rawText = removeMarkdown(chunkText, REMOVE_MARKDOWN_PARAMS);

    if (!chunkText || !rawText) {
      continue;
    }

    insertions.push({
      chunk_id: index,
      chunk_markdown_text: chunkText,
      chunk_raw_text: rawText,
      document_id: document.id,
      metadata: {
        documentTitle: chunk.metadata.documentTitle,
        excerptKeywords: chunk.metadata.excerptKeywords,
        sectionSummary: chunk.metadata.sectionSummary,
      },
      user_id: document.user_id,
      vector: embedding,
    });
  }

  if (insertions.length === 0) {
    await markTaskCompleted(
      input.taskId,
      "No insertions were made because the document was empty.",
    );
    return {
      reason: "No insertions were made because the document was empty.",
    };
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(DocumentEmbedding)
      .where(eq(DocumentEmbedding.document_id, input.documentId));

    await tx.insert(DocumentEmbedding).values(insertions);

    await tx
      .update(DocumentEmbeddingTask)
      .set({
        status: "completed",
      })
      .where(eq(DocumentEmbeddingTask.id, input.taskId));
  });

  return {};
}
embedDocumentForTask.maxRetries = 0;

async function markTaskFailure(input: {
  errorMessage: string;
  taskId: string;
  taskUpdatedAt: string;
}): Promise<{ reason: string; shouldRetry: boolean }> {
  "use step";

  const task = await db.query.DocumentEmbeddingTask.findFirst({
    columns: {
      retries: true,
      updated_at: true,
    },
    where: eq(DocumentEmbeddingTask.id, input.taskId),
  });

  if (!task) {
    return {
      reason: input.errorMessage,
      shouldRetry: false,
    };
  }

  if (hasTaskBeenSuperseded(task.updated_at, input.taskUpdatedAt)) {
    return {
      reason: "Task was superseded by a newer update",
      shouldRetry: false,
    };
  }

  if (task.retries < MAX_TASK_RETRIES) {
    await db
      .update(DocumentEmbeddingTask)
      .set({
        metadata: {
          message: input.errorMessage,
        },
        retries: sql`${DocumentEmbeddingTask.retries} + 1`,
        status: "debounced",
      })
      .where(eq(DocumentEmbeddingTask.id, input.taskId));

    return {
      reason: input.errorMessage,
      shouldRetry: true,
    };
  }

  await db
    .update(DocumentEmbeddingTask)
    .set({
      metadata: {
        message: input.errorMessage,
      },
      status: "failed",
    })
    .where(eq(DocumentEmbeddingTask.id, input.taskId));

  return {
    reason: input.errorMessage,
    shouldRetry: false,
  };
}
markTaskFailure.maxRetries = 0;

async function markTaskCompleted(taskId: string, message: string) {
  await db
    .update(DocumentEmbeddingTask)
    .set({
      metadata: {
        message,
      },
      status: "completed",
    })
    .where(eq(DocumentEmbeddingTask.id, taskId));
}

function hasTaskBeenSuperseded(
  currentUpdatedAt: string,
  taskUpdatedAt: string,
) {
  const current = Date.parse(currentUpdatedAt);
  const expected = Date.parse(taskUpdatedAt);

  if (Number.isNaN(current) || Number.isNaN(expected)) {
    return currentUpdatedAt !== taskUpdatedAt;
  }

  return current > expected;
}
