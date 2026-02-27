"use client";

import type { Folder } from "@acme/db/schema";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { DeleteFolderDialog } from "../../../@appSidebar/_components/delete-folder-button";

type FolderDeleteActionProps = {
  folder: Folder;
};

export function FolderDeleteAction({ folder }: FolderDeleteActionProps) {
  const [open, setOpen] = useState(false);

  return (
    <DeleteFolderDialog folder={folder} open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="destructive"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Trash2 />
        Delete folder
      </Button>
    </DeleteFolderDialog>
  );
}
