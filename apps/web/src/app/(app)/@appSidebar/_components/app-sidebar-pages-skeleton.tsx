import { ChevronRight, Loader2 } from "lucide-react";

export const AppSidebarPagesSkeleton = () => {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 pr-2 pl-4 text-foreground text-sm">
      <Loader2 className="size-3 animate-spin" />
      <span className="group-data-[collapsible=icon]:sr-only">Library</span>
      <ChevronRight className="ml-auto size-5 opacity-50 group-data-[collapsible=icon]:hidden" />
    </div>
  );
};
