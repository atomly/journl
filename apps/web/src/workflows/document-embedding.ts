import { blocknoteBlocks, blocknoteMarkdown } from "@acme/blocknote/server";
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import {
  Document,
  DocumentEmbedding,
  type zInsertDocumentEmbedding,
} from "@acme/db/schema";
import { type ChunkParams, MDocument } from "@mastra/rag";
import { embedMany } from "ai";
import removeMarkdown from "remove-markdown";
import { FatalError, sleep } from "workflow";
import { start } from "workflow/api";
import { z } from "zod/v4";

import { model } from "~/ai/providers/openai/embedding";
import { startModelUsage } from "./model-usage";
import { createTransaction } from "./utils/transaction";

const EMBEDDING_DEBOUNCE_DELAY = "30s";

const CHUNK_PARAMS: ChunkParams = {
  strategy: "semantic-markdown",
};

const REMOVE_MARKDOWN_PARAMS: Parameters<typeof removeMarkdown>[1] = {
  gfm: true,
  listUnicodeChar: "",
  stripListLeaders: true,
  useImgAltText: true,
};

const zDocumentEmbeddingInput = z.object({
  documentId: z.uuid(),
  documentUpdatedAt: z.string().min(1),
  userId: z.string().min(1),
});

type DocumentEmbeddingInput = z.infer<typeof zDocumentEmbeddingInput>;

export async function startDocumentEmbedding(input: DocumentEmbeddingInput) {
  await start(runDocumentEmbedding, [input]);
}

type DocumentEmbeddingResult = {
  documentId: string;
  reason?: string;
  status: "completed" | "skipped";
};

export async function runDocumentEmbedding(
  input: DocumentEmbeddingInput,
): Promise<DocumentEmbeddingResult> {
  "use workflow";

  const payload = await validateDocumentEmbeddingInput(input);

  await sleep(EMBEDDING_DEBOUNCE_DELAY);

  const documentState = await getDocumentState(payload);

  if (!documentState.shouldProcess) {
    return {
      documentId: payload.documentId,
      reason: documentState.reason,
      status: "skipped",
    };
  }

  try {
    const embeddingResult = await embedDocument(documentState.document);

    return {
      documentId: payload.documentId,
      reason: embeddingResult.reason,
      status: "completed",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    throw new FatalError(errorMessage);
  }
}

async function validateDocumentEmbeddingInput(
  input: DocumentEmbeddingInput,
): Promise<DocumentEmbeddingInput> {
  "use step";

  return zDocumentEmbeddingInput.parse(input);
}

async function getDocumentState(input: {
  documentId: string;
  documentUpdatedAt: string;
  userId: string;
}): Promise<
  | {
      reason: string;
      shouldProcess: false;
    }
  | {
      document: DocumentEmbeddingRecord;
      shouldProcess: true;
    }
> {
  "use step";

  const document = await getDocumentEmbeddingRecord({
    documentId: input.documentId,
    userId: input.userId,
  });

  if (!document) {
    return {
      reason: "Document not found",
      shouldProcess: false,
    };
  }

  if (hasDocumentBeenSuperseded(document.updated_at, input.documentUpdatedAt)) {
    return {
      reason: "Document has newer changes",
      shouldProcess: false,
    };
  }

  return {
    document,
    shouldProcess: true,
  };
}

async function embedDocument(
  document: DocumentEmbeddingRecord,
): Promise<{ reason?: string }> {
  "use step";

  const blocks = blocknoteBlocks(document.block_nodes, document.block_edges);
  const markdown = blocks ? await blocknoteMarkdown(blocks) : "";

  if (!removeMarkdown(markdown, REMOVE_MARKDOWN_PARAMS)) {
    await clearEmbeddings(document.id);

    return {
      reason: "The markdown is empty.",
    };
  }

  const mDocument = MDocument.fromMarkdown(markdown);
  const chunks = await mDocument.chunk(CHUNK_PARAMS);

  if (chunks.length === 0) {
    await clearEmbeddings(document.id);

    return {
      reason: "No chunks were produced from markdown.",
    };
  }

  const { embeddings, usage } = await embedMany({
    maxRetries: 5,
    model,
    values: chunks.map((chunk) => chunk.text),
  });

  await startModelUsage({
    metrics: [{ quantity: usage.tokens, unit: "tokens" }],
    modelId: model.modelId,
    modelProvider: model.provider,
    userId: document.user_id,
  });

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
    await clearEmbeddings(document.id);

    return {
      reason: "No insertions were made because the document was empty.",
    };
  }

  await createTransaction(async (tx) => {
    await tx
      .delete(DocumentEmbedding)
      .where(eq(DocumentEmbedding.document_id, document.id));

    await tx.insert(DocumentEmbedding).values(insertions);
  });

  return {};
}
embedDocument.maxRetries = 0;

async function clearEmbeddings(documentId: string) {
  await createTransaction(async (tx) => {
    await tx
      .delete(DocumentEmbedding)
      .where(eq(DocumentEmbedding.document_id, documentId));
  });
}

function hasDocumentBeenSuperseded(
  currentUpdatedAt: string,
  expectedUpdatedAt: string,
) {
  const current = Date.parse(currentUpdatedAt);
  const expected = Date.parse(expectedUpdatedAt);

  if (Number.isNaN(current) || Number.isNaN(expected)) {
    return currentUpdatedAt !== expectedUpdatedAt;
  }

  return current > expected;
}

async function getDocumentEmbeddingRecord(input: {
  documentId: string;
  userId: string;
}) {
  return await db.query.Document.findFirst({
    where: and(
      eq(Document.id, input.documentId),
      eq(Document.user_id, input.userId),
    ),
    with: {
      block_edges: true,
      block_nodes: true,
    },
  });
}

type DocumentEmbeddingRecord = NonNullable<
  Awaited<ReturnType<typeof getDocumentEmbeddingRecord>>
>;
