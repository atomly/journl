"use client";

import type { Page } from "@acme/db/schema";
import { Button } from "@acme/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import { cn } from "@acme/ui/utils";
import { MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type {
  CSSProperties,
  HTMLAttributes,
  MouseEventHandler,
  ReactNode,
} from "react";
import { useRef, useState } from "react";
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
  const actionTrigger = useRef<HTMLButtonElement | null>(null);
  const [deleteFromMenu, setDeleteFromMenu] = useState(false);
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
  const actionsMenu = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${page.title || "New page"}`}
            className="size-7 shrink-0 group-focus-within/page-row:pointer-events-auto group-focus-within/page-row:opacity-100 group-hover/page-row:pointer-events-auto group-hover/page-row:opacity-100 aria-expanded:pointer-events-auto aria-expanded:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:pointer-events-none [@media(hover:hover)_and_(pointer:fine)]:opacity-0"
            onFocus={(event) => {
              actionTrigger.current = event.currentTarget;
            }}
            onPointerDown={(event) => {
              actionTrigger.current = event.currentTarget;
              event.stopPropagation();
            }}
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>{moves.menuItems}</DropdownMenuGroup>
        {moves.menuItems && <DropdownMenuSeparator />}
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setDeleteFromMenu(true);
              setIsDeleteDialogOpen(true);
            }}
          >
            <Trash2 />
            Delete page
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
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
        "group/page-row",
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
            finalFocus={deleteFromMenu ? actionTrigger : undefined}
          >
            <SwipeAction
              disabled={isDragging}
              className="rounded-md md:hidden"
              onFullSwipe={() => {
                setDeleteFromMenu(false);
                setIsDeleteDialogOpen(true);
              }}
            >
              <SwipeActionReveal className="-ml-px">
                <DeletePageDialogTrigger
                  onClick={() => setDeleteFromMenu(false)}
                  render={
                    <DeletePageButton
                      variant="destructive"
                      className="h-7 w-full rounded-none px-3 text-xs"
                    >
                      Delete
                    </DeletePageButton>
                  }
                />
              </SwipeActionReveal>
              <SwipeActionContent
                className="group/swipe-content flex items-center rounded-md"
                {...dragActivatorProps}
              >
                <SidebarMenuSubButton
                  isActive={isActive}
                  className="min-h-7 rounded-md group-data-[state=open]/swipe-content:rounded-r-none"
                  render={
                    <Link
                      draggable={false}
                      data-tree-drag-handle
                      href={`/pages/${page?.id}`}
                      onClick={handlePageNavigationClick}
                      className="line-clamp-1 min-w-0 flex-1 truncate hover:underline"
                    >
                      {page?.title || "New page"}
                    </Link>
                  }
                />
                {actionsMenu}
              </SwipeActionContent>
            </SwipeAction>
            <SidebarMenuSubButton
              isActive={isActive}
              className="min-h-7 rounded-md"
              render={
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
                  </div>
                  {actionsMenu}
                </div>
              }
            />
          </DeletePageDialog>
        </div>
      </div>
    </SidebarMenuSubItem>
  );
}
