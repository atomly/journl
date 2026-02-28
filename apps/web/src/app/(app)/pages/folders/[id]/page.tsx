import { notFound } from "next/navigation";
import { api } from "~/trpc/server";
import { FolderDeleteAction } from "../_components/folder-delete-action";
import { FolderNestedPagesList } from "../_components/folder-nested-pages-list";
import { FolderTitleInput } from "../_components/folder-title-input";

export default async function FolderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const folder = await api.folders.getById({ id });

  if (!folder) {
    notFound();
  }

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-8 px-8 pt-8 pb-20">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-medium text-muted-foreground text-sm">Title</h1>
          <FolderDeleteAction folder={folder} />
        </div>
        <FolderTitleInput
          folder={{
            id: folder.id,
            name: folder.name,
            parent_node_id: folder.parent_node_id,
          }}
        />
      </section>

      <FolderNestedPagesList rootFolderId={folder.id} />
    </div>
  );
}
