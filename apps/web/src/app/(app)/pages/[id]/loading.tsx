import { PageSkeleton } from "../_components/page-skeleton";

export default function Loading() {
  return (
    <div
      data-reading-surface
      className="flex min-h-full flex-col gap-4 pt-8 pb-52"
    >
      <PageSkeleton />
    </div>
  );
}
