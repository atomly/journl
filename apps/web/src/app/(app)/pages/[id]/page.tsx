import { notFound } from "next/navigation";
import { api } from "~/trpc/server";
import { DynamicPageEditor } from "../_components/page-editor.dynamic";
import { PageShell } from "../_components/page-shell";
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
    <PageShell
      page={{
        id,
      }}
      className="mx-auto flex min-h-full max-w-5xl flex-col gap-4 pt-8 pb-52"
    >
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
            node_id: page.node_id,
            parent_node_id: page.parent_node_id,
            title: page.title,
          }}
          className="px-8 py-2"
        />
      </DynamicPageEditor>
    </PageShell>
  );
}
