import { Skeleton } from "~/components/ui/skeleton";

export function FolderDetailsSkeleton() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-8 pt-8 pb-20">
      <section className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-11 w-full" />
      </section>

      <section className="flex flex-col gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-1 rounded-3xl border p-2">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      </section>
    </div>
  );
}
