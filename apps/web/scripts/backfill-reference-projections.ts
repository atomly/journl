import { and, asc, count, eq, gt } from "@acme/db";
import { db } from "@acme/db/client";
import {
  BlockNode,
  BlockSearchText,
  Document,
  DocumentReference,
} from "@acme/db/schema";
import { rebuildReferenceProjection } from "../src/trpc/shared/block-transaction";

// Run the full owner-scoped backfill with `pnpm references:backfill`; resume
// with `-- --after=<document-uuid>`. Repair one source with
// `-- --document-id=<uuid> --user-id=<id>`.

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

async function rebuildDocument(documentId: string, expectedUserId?: string) {
  return db.transaction(async (tx) => {
    const [source] = await tx
      .select({ id: Document.id, userId: Document.user_id })
      .from(Document)
      .where(
        and(
          eq(Document.id, documentId),
          expectedUserId ? eq(Document.user_id, expectedUserId) : undefined,
        ),
      )
      .for("update");
    if (!source) return null;
    const blocks = await tx
      .select()
      .from(BlockNode)
      .where(
        and(
          eq(BlockNode.user_id, source.userId),
          eq(BlockNode.document_id, source.id),
        ),
      );
    const projection = await rebuildReferenceProjection(
      tx,
      source.userId,
      source.id,
      blocks,
      false,
    );
    const [[referenceRows], [searchRows]] = await Promise.all([
      tx
        .select({ count: count() })
        .from(DocumentReference)
        .where(
          and(
            eq(DocumentReference.user_id, source.userId),
            eq(DocumentReference.source_document_id, source.id),
          ),
        ),
      tx
        .select({ count: count() })
        .from(BlockSearchText)
        .where(
          and(
            eq(BlockSearchText.user_id, source.userId),
            eq(BlockSearchText.document_id, source.id),
          ),
        ),
    ]);
    const reconciled =
      referenceRows?.count === projection.referenceCount &&
      searchRows?.count === projection.blockSearchTextCount;
    if (!reconciled)
      throw new Error("Projection row counts did not reconcile.");
    return {
      blockCount: blocks.length,
      documentId: source.id,
      malformedCount: projection.malformedCount,
      reconciled,
      referenceCount: referenceRows?.count ?? 0,
      searchBlockCount: searchRows?.count ?? 0,
      unresolvedRouteCount: projection.unresolvedRouteCount,
      userId: source.userId,
    };
  });
}

async function main() {
  const repairDocumentId = argument("document-id");
  const repairUserId = argument("user-id");
  if (repairDocumentId) {
    if (!UUID.test(repairDocumentId) || !repairUserId) {
      throw new Error(
        "Repair requires --document-id=<uuid> and --user-id=<id>.",
      );
    }
    const result = await rebuildDocument(repairDocumentId, repairUserId);
    if (!result) throw new Error("Owned document was not found.");
    console.info(
      JSON.stringify({
        event: "reference-projection-repair",
        ...result,
      }),
    );
    return;
  }

  let cursor = argument("after");
  if (cursor && !UUID.test(cursor))
    throw new Error("--after must be a document UUID.");
  let _processed = 0;
  let totals = { malformed: 0, references: 0, searchBlocks: 0, unresolved: 0 };
  while (true) {
    const batch = await db
      .select({ id: Document.id })
      .from(Document)
      .where(cursor ? gt(Document.id, cursor) : undefined)
      .orderBy(asc(Document.id))
      .limit(100);
    if (batch.length === 0) break;
    for (const document of batch) {
      const result = await rebuildDocument(document.id);
      if (result) {
        _processed += 1;
        totals = {
          malformed: totals.malformed + result.malformedCount,
          references: totals.references + result.referenceCount,
          searchBlocks: totals.searchBlocks + result.searchBlockCount,
          unresolved: totals.unresolved + result.unresolvedRouteCount,
        };
      }
      cursor = document.id;
      console.info(
        JSON.stringify({
          ...totals,
          cursor,
          event: "reference-projection-backfill-progress",
          processed: _processed,
          resume: `--after=${cursor}`,
        }),
      );
    }
  }
  console.info(
    JSON.stringify({
      ...totals,
      event: "reference-projection-backfill-complete",
      processed: _processed,
      resume: null,
    }),
  );
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Reference projection backfill failed.",
  );
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
