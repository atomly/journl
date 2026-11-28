import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExploreNoteLink } from "~/components/references/explore-note-link";
import { api } from "~/trpc/server";
import { DynamicPageEditor } from "../_components/page-editor.dynamic";
import { PageShell } from "../_components/page-shell";
import { PageSkeleton } from "../_components/page-skeleton";
import { PageTitleTextarea } from "../_components/page-title-textarea";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const page = await api.pages.getById({ id });

  if (!page) {
    notFound();
  }

  const { blocks, ...pageDetails } = page;

  return (
    <Suspense
      fallback={
        <div
          data-reading-surface
          className="flex min-h-full flex-col gap-4 pt-8"
        >
          <PageSkeleton />
        </div>
      }
    >
      <PageShell
        page={{
          id,
        }}
      >
        <DynamicPageEditor page={pageDetails} initialBlocks={blocks}>
          <div data-editor-heading className="flex items-start gap-3">
            <PageTitleTextarea
              page={{
                id: page.id,
                node_id: page.node_id,
                parent_node_id: page.parent_node_id,
                title: page.title,
              }}
              className="min-w-0 flex-1 py-2"
            />
            <ExploreNoteLink documentId={page.document_id} />
          </div>
        </DynamicPageEditor>
      </PageShell>
    </Suspense>
  );
}
