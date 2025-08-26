import {
  zDocumentEmbeddingTask,
  type zInsertDocumentEmbedding,
} from "@acme/db/schema";
import { ServerBlockNoteEditor } from "@blocknote/server-util";
import { type ChunkParams, MDocument } from "@mastra/rag";
import { embedMany } from "ai";
import { NextResponse } from "next/server";
import removeMarkdown from "remove-markdown";
import type { z } from "zod/v4";
import { model } from "~/ai/providers/openai/embedding";
import { schema } from "~/components/editor/block-schema";
import { api, embedder } from "~/trpc/server";
import { handler } from "../_lib/webhook-handler";

const CHUNK_PARAMS: ChunkParams = {
  extract: {
    keywords: true,
    summary: true,
    title: true,
  },
  strategy: "semantic-markdown",
};
const REMOVE_MARKDOWN_PARAMS: Parameters<typeof removeMarkdown>[1] = {
  /* GitHub-Flavored Markdown */
  gfm: true,
  /* Char to insert instead of stripped list leaders */
  listUnicodeChar: "",
  /* Strip list leaders */
  stripListLeaders: true,
  /* Replace images with alt-text, if present */
  useImgAltText: true,
};

/**
 * This webhook will embed a document when the task is marked as ready by the Supabase Cronjob.
 *
 * @privateRemarks
 *
 * There are three jobs that are responsible for the lifecycle of the document embedding task:
 *
 * 1. `document-embedding-scheduler`: This job will mark debounced tasks as ready after 2 minutes without updates.
 * ```sql
 * -- Debounced → Ready (after 2 minutes)
 * UPDATE document_embedding_task
 * SET
 *   status = 'ready',
 *   updated_at = NOW()
 * WHERE
 *   status = 'debounced'
 *   AND updated_at < NOW() - INTERVAL '2 minutes';
 * ```
 *
 * 2. `document-embedding-retrier`: This job will retry failed tasks that have failed less than 3 times every 5 minutes.
 * ```sql
 * -- Failed → Debounced (with retry increment, max 3 retries)
 * UPDATE document_embedding_task
 * SET
 *   status = 'debounced',
 *   retries = retries + 1,
 *   updated_at = NOW()
 * WHERE
 *   status = 'failed'
 *   AND retries < 3
 *   AND updated_at < NOW() - INTERVAL '5 minutes';
 * ```
 *
 * 3. `document-embedding-sentinel`: This job picks up tasks that been ready for more than 15 minutes without updates.
 * ```sql
 * -- Stuck Ready → Failed (after 15 minutes)
 * UPDATE document_embedding_task
 * SET
 *   status = 'failed',
 *   updated_at = NOW()
 * WHERE
 *   status = 'ready'
 *   AND updated_at < NOW() - INTERVAL '15 minutes';
 * ```
 */
// ! TODO: Track embeddings token usage.
export const POST = handler(zDocumentEmbeddingTask, async (payload) => {
  if (payload.type === "DELETE" || payload.record.status !== "ready") {
    return NextResponse.json({ success: true });
  }

  try {
    const document = await embedder.document.getById({
      id: payload.record.document_id,
      user_id: payload.record.user_id,
    });

    if (!document?.tree) {
      throw new Error("Document not found");
    }

    const editor = ServerBlockNoteEditor.create({
      schema,
    });

    const markdown = await editor.blocksToMarkdownLossy(document.tree);

    const mDocument =
      await MDocument.fromMarkdown(markdown).chunk(CHUNK_PARAMS);

    const { embeddings, usage } = await embedMany({
      maxRetries: 5,
      model,
      values: mDocument.map((chunk) => chunk.text),
    });

    await api.usage.trackAiModelUsage({
      metadata: {
        document_id: document.id,
        model_version: model.specificationVersion,
      },
      metrics: [{ quantity: usage.tokens, unit: "tokens" }],
      model_id: model.modelId,
      model_provider: model.provider,
      user_id: document.user_id,
    });

    const insertions: z.infer<typeof zInsertDocumentEmbedding>[] = [];

    for (const [index, embedding] of embeddings.entries()) {
      const chunk = mDocument.at(index);

      if (!chunk) {
        continue;
      }

      console.debug("DocumentEmbedding 👀", {
        chunk,
      });

      insertions.push({
        chunk_id: index,
        chunk_markdown_text: chunk.text,
        chunk_raw_text: removeMarkdown(chunk.text, REMOVE_MARKDOWN_PARAMS),
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

    await embedder.documentEmbedding.embedDocument({
      document_id: payload.record.document_id,
      embeddings: insertions,
      task_id: payload.record.id,
      user_id: payload.record.user_id,
    });
  } catch (error) {
    console.error("Error embedding document 👀", error);

    await embedder.documentEmbeddingTask.updateStatus({
      id: payload.record.id,
      status: "failed",
    });
  }

  return NextResponse.json({ success: true });
});
