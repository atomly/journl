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
      <SidebarMenuSubButton asChild>
        <div
          className={
            "group/page-item flex items-center justify-between p-0! hover:bg-transparent"
          }
        >
          <Skeleton className="h-5 w-full rounded-sm" />
        </div>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}
