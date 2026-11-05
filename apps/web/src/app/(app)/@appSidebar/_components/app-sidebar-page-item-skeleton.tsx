"use client";

import { Skeleton } from "@acme/ui/skeleton";
import {
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "~/components/ui/sidebar";

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
          className="min-h-7 rounded-md"
          render={
            <div className="group/page-item flex items-center hover:bg-transparent">
              <Skeleton className="h-7 w-full rounded-md" />
            </div>
          }
        />
      </div>
    </SidebarMenuSubItem>
  );
}
