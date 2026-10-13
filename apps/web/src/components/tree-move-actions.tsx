"use client";

import { ArrowDown, ArrowUp, FolderInput } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { DropdownMenuItem } from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";

export function TreeMoveMenuItems({
  disabled = false,
  onMoveUp,
  onMoveDown,
  onChooseFolder,
}: {
  disabled?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onChooseFolder: () => void;
}) {
  return (
    <>
      <DropdownMenuItem disabled={disabled || !onMoveUp} onClick={onMoveUp}>
        <ArrowUp />
        Move up
      </DropdownMenuItem>
      <DropdownMenuItem disabled={disabled || !onMoveDown} onClick={onMoveDown}>
        <ArrowDown />
        Move down
      </DropdownMenuItem>
      <DropdownMenuItem disabled={disabled} onClick={onChooseFolder}>
        <FolderInput />
        Move to…
      </DropdownMenuItem>
    </>
  );
}

export type TreeMoveDestination = {
  nodeId: string | null;
  label: string;
  disabled?: boolean;
};

export function TreeMoveDialog({
  open,
  onOpenChange,
  itemLabel,
  destinations,
  currentParentNodeId,
  pending = false,
  onMove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemLabel: string;
  destinations: TreeMoveDestination[];
  currentParentNodeId: string | null;
  pending?: boolean;
  onMove: (parentNodeId: string | null) => void;
}) {
  const searchId = useId();
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);
  const matchingDestinations = destinations.filter((destination) =>
    destination.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {itemLabel}</DialogTitle>
          <DialogDescription>
            Choose where to place this item.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor={searchId} className="text-muted-foreground text-sm">
            Find a folder
          </label>
          <Input
            id={searchId}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search destinations"
            disabled={pending}
          />
        </div>
        <ul
          aria-label="Move destinations"
          className="max-h-64 space-y-1 overflow-y-auto"
        >
          {matchingDestinations.map((destination) => (
            <li key={destination.nodeId ?? "root"}>
              <Button
                variant="ghost"
                className="h-auto min-h-10 w-full justify-start whitespace-normal text-left"
                disabled={
                  pending ||
                  destination.disabled ||
                  destination.nodeId === currentParentNodeId
                }
                onClick={() => onMove(destination.nodeId)}
              >
                <FolderInput className="shrink-0" />
                <span className="min-w-0 break-words">{destination.label}</span>
                {destination.nodeId === currentParentNodeId ? (
                  <span className="ml-auto shrink-0 text-muted-foreground text-xs">
                    Current
                  </span>
                ) : null}
              </Button>
            </li>
          ))}
          {matchingDestinations.length === 0 ? (
            <li
              className="px-2 py-3 text-muted-foreground text-sm"
              role="status"
            >
              No matching destinations
            </li>
          ) : null}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
