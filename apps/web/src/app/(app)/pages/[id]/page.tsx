import { notFound } from "next/navigation";
import { Suspense } from "react";
import { api } from "~/trpc/server";
import { DynamicPageEditor } from "../_components/page-editor.dynamic";
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

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-4 pt-8 pb-52">
      <Suspense fallback={<PageSkeleton />}>
        <DynamicPageEditor
          page={{
            document_id: page.document_id,
            id: page.id,
            title: page.title,
          }}
          initialBlocks={page.blocks}
        >
          <PageTitleTextarea
            page={{
              id: page.id,
              title: page.title,
            }}
            className="px-8 py-0"
          />
        </DynamicPageEditor>
      </Suspense>
    </div>
  );
}
