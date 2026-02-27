import { ChevronRight, Loader2 } from "lucide-react";

export const AppSidebarPagesSkeleton = () => {
  return (
    <div className="flex min-h-8 items-center gap-2 rounded-md border border-transparent p-2 text-foreground text-sm">
      <Loader2 className="size-3 animate-spin" />
      <span>Pages</span>
      <ChevronRight className="ml-auto size-4 opacity-50" />
    </div>
  );
};
