"use client";

import { cn } from "@acme/ui/utils";
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
  const { isMobile, setOpenMobile } = useSidebar();

  const isActive = (url: string) => pathname === url;
  const handleNavigationClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            tooltip={item.title}
            isActive={isActive(item.url)}
            className={cn(
              "border border-transparent text-foreground!",
              isActive(item.url) && "border-sidebar-primary/50",
            )}
            render={
              <Link href={item.url} onClick={handleNavigationClick}>
                {item.icon && item.icon}
                <span>{item.title}</span>
              </Link>
            }
          />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
