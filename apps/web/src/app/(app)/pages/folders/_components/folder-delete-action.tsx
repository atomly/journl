"use client";

import type { Folder } from "@acme/db/schema";
import { Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { DeleteFolderDialog } from "../../../@appSidebar/_components/delete-folder-button";

type FolderDeleteActionProps = {
  folder: Folder;
};

export function FolderDeleteAction({ folder }: FolderDeleteActionProps) {
  const [open, setOpen] = useState(false);

  return (
    <DeleteFolderDialog folder={folder} open={open} onOpenChange={setOpen}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="icon">
            <Settings className="size-4" />
            <span className="sr-only">Folder settings</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setOpen(true);
            }}
          >
            <Trash2 />
            Delete folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </DeleteFolderDialog>
  );
}
