"use client";

import {
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "~/components/ui/sidebar";
import { Skeleton } from "~/components/ui/skeleton";
import {
  SIDEBAR_TREE_ROW_INTERACTIVE_CLASSNAME,
  SIDEBAR_TREE_ROW_SKELETON_CLASSNAME,
  SIDEBAR_TREE_ROW_WRAPPER_CLASSNAME,
} from "./app-sidebar-tree-row";

type AppSidebarPageItemSkeletonProps = {
  className?: string;
};

export function AppSidebarPageItemSkeleton({
  className,
}: AppSidebarPageItemSkeletonProps) {
  return (
    <SidebarMenuSubItem className={className}>
      <div className={SIDEBAR_TREE_ROW_WRAPPER_CLASSNAME}>
        <SidebarMenuSubButton
          asChild
          className={SIDEBAR_TREE_ROW_INTERACTIVE_CLASSNAME}
        >
          <div className="group/page-item flex items-center hover:bg-transparent">
            <Skeleton className={SIDEBAR_TREE_ROW_SKELETON_CLASSNAME} />
          </div>
        </SidebarMenuSubButton>
      </div>
    </SidebarMenuSubItem>
  );
}
