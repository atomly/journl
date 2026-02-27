import { PageSkeleton } from "../_components/page-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-4 pt-8 pb-52">
      <PageSkeleton />
    </div>
  );
}
