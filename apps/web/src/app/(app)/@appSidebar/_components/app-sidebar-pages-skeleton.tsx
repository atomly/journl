"use client";

import { ChevronRight, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleTrigger } from "~/components/ui/collapsible";
import { SidebarMenuButton } from "~/components/ui/sidebar";

export const AppSidebarPagesSkeleton = () => {
  return (
    <Collapsible defaultOpen={false} className="group/collapsible">
      <CollapsibleTrigger asChild>
        <SidebarMenuButton tooltip="Pages">
          <Loader2 className="animate-spin" />
          <span>Pages</span>
          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
        </SidebarMenuButton>
      </CollapsibleTrigger>
    </Collapsible>
  );
};
