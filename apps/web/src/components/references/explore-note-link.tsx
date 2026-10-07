import { Compass } from "lucide-react";
import Link from "next/link";

export function ExploreNoteLink({ documentId }: { documentId: string }) {
  return (
    <Link
      href={`/graph?documentId=${documentId}`}
      aria-label="Explore this note"
      title="Explore this note"
      className="inline-flex pointer-coarse:size-11 size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Compass className="size-4" aria-hidden="true" />
    </Link>
  );
}
