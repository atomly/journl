"use client";

import type { Page } from "@acme/db/schema";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type {
  CSSProperties,
  HTMLAttributes,
  MouseEventHandler,
  ReactNode,
} from "react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "~/components/ui/sidebar";
import {
  SwipeAction,
  SwipeActionContent,
  SwipeActionReveal,
} from "~/components/ui/swipe-action";
import { useTreeItemMoves } from "~/hooks/use-tree-item-moves";
import { cn } from "~/lib/cn";
import {
  DeletePageButton,
  DeletePageDialog,
  DeletePageDialogTrigger,
} from "./delete-page-button";

type AppSidebarPageItemProps = {
  page: Page;
  className?: string;
  dragActivatorProps?: HTMLAttributes<HTMLDivElement>;
  dropOverlay?: ReactNode;
  isDragging?: boolean;
  itemRef?: (node: HTMLLIElement | null) => void;
  itemStyle?: CSSProperties;
  onItemClickCapture?: MouseEventHandler<HTMLLIElement>;
};

export function AppSidebarPageItem({
  page,
  className,
  dragActivatorProps,
  dropOverlay,
  isDragging = false,
  itemRef,
  itemStyle,
  onItemClickCapture,
}: AppSidebarPageItemProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const moves = useTreeItemMoves(
    page.node_id
      ? {
          label: page.title || "New page",
          node_id: page.node_id,
          parent_node_id: page.parent_node_id ?? null,
        }
      : undefined,
  );
  const moveMenu = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${page.title || "New page"}`}
          className="size-7 shrink-0"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{moves.menuItems}</DropdownMenuContent>
    </DropdownMenu>
  );

  const isActive = pathname.includes(page?.id ?? "");
  const handlePageNavigationClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarMenuSubItem
      ref={itemRef}
      style={itemStyle}
      onClickCapture={onItemClickCapture}
      className={cn(
        isDragging && "opacity-60",
        isActive && "border-sidebar-primary",
        className,
      )}
    >
      <div className="relative py-1">
        {dropOverlay}
        <div className="relative z-10">
          <DeletePageDialog
            page={page}
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
          >
            <SwipeAction
              disabled={isDragging}
              className="rounded-md md:hidden"
              onFullSwipe={() => {
                setIsDeleteDialogOpen(true);
              }}
            >
              <SwipeActionReveal className="-ml-px">
                <DeletePageDialogTrigger asChild>
                  <DeletePageButton
                    variant="destructive"
                    className="h-7 w-full rounded-none px-3 text-xs"
                  >
                    Delete
                  </DeletePageButton>
                </DeletePageDialogTrigger>
              </SwipeActionReveal>
              <SwipeActionContent
                className="group/swipe-content flex items-center rounded-md"
                {...dragActivatorProps}
              >
                <SidebarMenuSubButton
                  asChild
                  isActive={isActive}
                  className="min-h-7 rounded-md group-data-[state=open]/swipe-content:rounded-r-none"
                >
                  <Link
                    draggable={false}
                    data-tree-drag-handle
                    href={`/pages/${page?.id}`}
                    onClick={handlePageNavigationClick}
                    className="line-clamp-1 min-w-0 flex-1 truncate hover:underline"
                  >
                    {page?.title || "New page"}
                  </Link>
                </SidebarMenuSubButton>
                {moveMenu}
              </SwipeActionContent>
            </SwipeAction>
            <SidebarMenuSubButton
              asChild
              isActive={isActive}
              className="min-h-7 rounded-md"
            >
              <div
                {...dragActivatorProps}
                className="group/page-item hidden select-none items-center md:flex"
              >
                <div className="relative min-w-0 flex-1">
                  <Link
                    draggable={false}
                    data-tree-drag-handle
                    href={`/pages/${page?.id}`}
                    onClick={handlePageNavigationClick}
                    className="block w-full min-w-0 truncate hover:underline"
                  >
                    {page?.title || "New page"}
                  </Link>
                  {!!page && (
                    <button
                      type="button"
                      draggable
                      aria-label={`Drag reference to ${page.title || "New page"}`}
                      title="Drag into an editor to add a reference"
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "copy";
                        event.dataTransfer.setData(
                          "application/x-journl-page-reference",
                          JSON.stringify({ pageId: page.id }),
                        );
                      }}
                      className="pointer-events-none invisible absolute top-1/2 right-6 -translate-y-1/2 rounded px-1 text-muted-foreground opacity-0 transition-opacity group-focus-within/page-item:pointer-events-auto group-focus-within/page-item:visible group-focus-within/page-item:opacity-100 group-hover/page-item:pointer-events-auto group-hover/page-item:visible group-hover/page-item:opacity-100"
                    >
                      ↗
                    </button>
                  )}
                  {!!page && (
                    <DeletePageDialogTrigger asChild>
                      <DeletePageButton
                        className={cn(
                          {
                            "bg-muted!": !isActive,
                            "bg-sidebar-accent!": isActive,
                          },
                          "pointer-events-none invisible absolute top-1/2 right-0 -translate-y-1/2 rounded-none p-0! pl-1! text-destructive! opacity-0 transition-opacity",
                          "group-focus-within/page-item:pointer-events-auto group-focus-within/page-item:visible group-focus-within/page-item:opacity-100 group-hover/page-item:pointer-events-auto group-hover/page-item:visible group-hover/page-item:opacity-100",
                        )}
                      />
                    </DeletePageDialogTrigger>
                  )}
                </div>
                {moveMenu}
              </div>
            </SidebarMenuSubButton>
          </DeletePageDialog>
        </div>
      </div>
    </SidebarMenuSubItem>
  );
}
