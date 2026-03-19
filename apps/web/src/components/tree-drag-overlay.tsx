import { DragOverlay } from "@dnd-kit/core";

export function TreeDragOverlay({ label }: { label: string | null }) {
  return (
    <DragOverlay dropAnimation={null}>
      {label ? (
        <div className="flex h-7 items-center gap-2 rounded-md bg-sidebar-accent px-2 text-sm shadow-md ring-1 ring-sidebar-border">
          {label}
        </div>
      ) : null}
    </DragOverlay>
  );
}
