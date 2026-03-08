import { Search } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";

export function HeaderSearchTrigger({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <Button
      data-slot="header-search-trigger"
      variant="outline"
      className={cn(
        "relative h-8 @[280px]:w-full w-8 @[280px]:max-w-48 @[280px]:justify-start justify-center overflow-hidden bg-background font-normal text-foreground text-sm shadow-none",
        className,
      )}
      aria-label="Search notes"
      {...props}
    >
      <Search
        data-slot="header-search-icon"
        className="@[280px]:hidden size-4 shrink-0"
      />
      <span data-slot="header-search-label" className="@[280px]:inline hidden">
        Search notes...
      </span>
      <div
        data-slot="header-search-shortcuts"
        className="pointer-events-none absolute top-1.5 right-1.5 @[280px]:flex hidden items-center gap-0.5"
      >
        <kbd className="hidden h-5 select-none items-center rounded border bg-background px-1.5 font-medium font-mono text-foreground text-lg md:flex">
          ⌘
        </kbd>
        <kbd className="hidden h-5 select-none items-center rounded border bg-background px-1.5 font-medium font-mono text-foreground text-xs md:flex">
          K
        </kbd>
      </div>
    </Button>
  );
}
