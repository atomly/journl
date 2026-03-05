import { Skeleton } from "~/components/ui/skeleton";

export function FolderDetailsSkeleton() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-8 pt-8 pb-20">
      <section className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-11 w-full" />
      </section>

      <section className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-36" />
      </section>

      <section className="space-y-2 rounded-lg border border-dashed p-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-72" />
      </section>

      <section className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <div className="space-y-2 rounded-md border p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </section>
    </div>
  );
}
