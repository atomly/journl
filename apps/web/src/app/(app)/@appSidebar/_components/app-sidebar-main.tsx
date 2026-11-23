"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";

type AppSidebarNavigationLink = {
  title: string;
  url: string;
  icon?: ReactNode;
  isActive?: boolean;
};

type AppSidebarNavigationItem =
  | {
      title: string;
      url: string;
      icon?: ReactNode;
      isActive?: boolean;
      items?: AppSidebarNavigationLink[];
    }
  | AppSidebarNavigationLink;

type AppSidebarNavigationProps = {
  items: AppSidebarNavigationItem[];
};

export function AppSidebarNavigation({ items }: AppSidebarNavigationProps) {
  const pathname = usePathname();
  const { isMobile, openMobile, setOpenMobile } = useSidebar();

  const isActive = (url: string) =>
    pathname === url ||
    (url === "/journal" && pathname.startsWith("/journal/")) ||
    (url === "/explore" && pathname === "/graph");
  const handleNavigationClick = () => {
    if (isMobile || openMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarMenu className="gap-2">
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            tooltip={item.title}
            isActive={isActive(item.url)}
            className="h-11 gap-2 rounded-[12px] border-0 px-4 text-sm [&>svg]:size-5"
            render={
              <Link
                href={item.url}
                aria-current={isActive(item.url) ? "page" : undefined}
                onClick={handleNavigationClick}
              >
                {item.icon && item.icon}
                <span className="group-data-[collapsible=icon]:sr-only">
                  {item.title}
                </span>
              </Link>
            }
          />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
