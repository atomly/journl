"use client";
import type { Page } from "@acme/db/schema";
import { Button } from "@acme/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTreeItemMoves } from "~/hooks/use-tree-item-moves";
import { DeletePageDialog } from "../../@appSidebar/_components/delete-page-button";

export function LibraryPageActions({ page }: { page: Page }) {
  const [deleting, setDeleting] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const moves = useTreeItemMoves(
    page.node_id
      ? {
          label: page.title || "New page",
          node_id: page.node_id,
          parent_node_id: page.parent_node_id ?? null,
        }
      : undefined,
  );
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              ref={trigger}
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${page.title || "New page"}`}
              className="library-row-action"
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            {moves.menuItems}
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleting(true)}
            >
              <Trash2 />
              Delete page
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeletePageDialog
        page={page}
        open={deleting}
        onOpenChange={setDeleting}
        finalFocus={trigger}
      >
        {null}
      </DeletePageDialog>
    </>
  );
}
