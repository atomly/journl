"use client";

import type { Page } from "@acme/db/schema";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  SidebarMenuButton,
  SidebarMenuSub,
  useSidebar,
} from "~/components/ui/sidebar";
import { useTRPC } from "~/trpc/react";
import { AppSidebarPageItem } from "./app-sidebar-page-item";
import { CreatePageButton } from "./create-page-button";

type AppSidebarPagesProps = {
  pages: Page[];
};

export const AppSidebarPages = (props: AppSidebarPagesProps) => {
  const trpc = useTRPC();
  const pathname = usePathname();
  const { state, setOpen } = useSidebar();

  const { data: pages } = useQuery({
    ...trpc.pages.getByUser.queryOptions(),
    initialData: props.pages,
  });

  const defaultOpen = pathname.includes("/pages/");
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handlePagesClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (state === "collapsed") {
      setOpen(true);
      setIsOpen(true);
    } else {
      setIsOpen((prev) => !prev);
    }
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="group/collapsible"
    >
      <CollapsibleTrigger asChild>
        <SidebarMenuButton tooltip="Pages" onClick={handlePagesClick}>
          <BookOpen />
          <span>Pages</span>
          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
        </SidebarMenuButton>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub className="mr-0 pr-0">
          <CreatePageButton />
          {pages?.map((page) => (
            <AppSidebarPageItem key={page.id} page={page} />
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
};
