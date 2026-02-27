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
        <h1 className="font-medium text-muted-foreground text-sm">Title</h1>
        <FolderTitleInput
          folder={{
            id: folder.id,
            name: folder.name,
            parent_folder_id: folder.parent_folder_id,
          }}
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-base">Folder actions</h2>
        <FolderDeleteAction folder={folder} />
      </section>

      <section className="rounded-lg border border-dashed p-4">
        <h2 className="font-semibold text-base">AI Rules (coming soon)</h2>
        <p className="text-muted-foreground text-sm">
          This area is reserved for future agent rules and folder-level AI
          behavior.
        </p>
      </section>

      <FolderNestedPagesList rootFolderId={folder.id} />
    </div>
  );
}
