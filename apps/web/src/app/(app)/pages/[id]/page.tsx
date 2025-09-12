import { notFound } from "next/navigation";
import { Suspense } from "react";
import { api } from "~/trpc/server";
import { DynamicPageEditor } from "../_components/page-editor.dynamic";
import { PageEditorSkeleton } from "../_components/page-editor-skeleton";
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

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-4 pt-8 pb-20">
      <div className="min-h-0 flex-1">
        <PageTitleTextarea
          page={{
            id: page.id,
            title: page.title,
          }}
          className="mb-4 px-13 py-0"
        />
        <Suspense fallback={<PageEditorSkeleton />}>
          <DynamicPageEditor
            page={{
              document_id: page.document_id,
              id: page.id,
              title: page.title,
            }}
            initialBlocks={page.blocks}
          />
        </Suspense>
      </div>
    </div>
  );
}
