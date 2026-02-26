"use client";

import type { Page } from "@acme/db/schema";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "~/components/ui/sidebar";
import { cn } from "~/lib/cn";
import { DeletePageButton } from "./delete-page-button";

type AppSidebarPageItemProps = {
  page: Page;
  className?: string;
};

export function AppSidebarPageItem({
  page,
  className,
}: AppSidebarPageItemProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const isActive = pathname.includes(page?.id ?? "");
  const handlePageNavigationClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarMenuSubItem
      key={page?.id}
      className={cn(
        "border-sidebar-border border-l",
        isActive && "border-sidebar-primary",
        className,
      )}
    >
      <SidebarMenuSubButton asChild isActive={isActive}>
        <div
          className={cn("group/page-item flex items-center justify-between")}
        >
          <Link
            href={`/pages/${page?.id}`}
            onClick={handlePageNavigationClick}
            className="line-clamp-1 min-w-0 flex-1 truncate hover:underline"
          >
            {page?.title || "New page"}
          </Link>
          {!!page && (
            <DeletePageButton
              className="hidden bg-transparent! pr-0! text-destructive! group-hover/page-item:block"
              page={page}
            />
          )}
        </div>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}
