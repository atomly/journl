"use client";

import {
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "~/components/ui/sidebar";
import { Skeleton } from "~/components/ui/skeleton";

type AppSidebarPageItemSkeletonProps = {
  className?: string;
};

export function AppSidebarPageItemSkeleton({
  className,
}: AppSidebarPageItemSkeletonProps) {
  return (
    <SidebarMenuSubItem className={className}>
      <div className="relative py-1">
        <SidebarMenuSubButton
          asChild
          className="min-h-7 rounded-md"
        >
          <div className="group/page-item flex items-center hover:bg-transparent">
            <Skeleton className="h-7 w-full rounded-md" />
          </div>
        </SidebarMenuSubButton>
      </div>
    </SidebarMenuSubItem>
  );
}
