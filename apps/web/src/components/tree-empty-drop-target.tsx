import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export function TreeEmptyDropTarget({
  active,
  isOver,
  targetRef,
  className,
  children,
}: {
  active: boolean;
  isOver: boolean;
  targetRef: (node: HTMLDivElement | null) => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      aria-hidden={!active}
      className={cn(
        "grid min-h-0 transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
        active ? "grid-rows-[1fr]" : "pointer-events-none grid-rows-[0fr]",
        className,
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="py-1.5">
          <div
            ref={targetRef}
            className={cn(
              "min-h-7 rounded-md border border-dashed transition-colors duration-200 motion-reduce:transition-none",
              active && isOver
                ? "border-sidebar-primary bg-sidebar-primary/10"
                : "border-sidebar-border/60",
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
