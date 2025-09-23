"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar";
import { cn } from "~/components/utils";

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

  const isActive = (url: string) => pathname === url;

  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            tooltip={item.title}
            asChild
            className={cn(isActive(item.url) && "bg-muted")}
          >
            <Link href={item.url}>
              {item.icon && item.icon}
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
