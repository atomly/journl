"use client";
import { buttonVariants } from "@acme/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@acme/ui/tooltip";
import { cn } from "cn";
import { Compass } from "lucide-react";
import Link from "next/link";

export function ExploreNoteLink({ documentId }: { documentId: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={`/explore?documentId=${documentId}`}
            aria-label="Explore this note"
            className={cn(
              buttonVariants({ size: "icon", variant: "ghost" }),
              "pointer-coarse:size-11 size-10 text-muted-foreground",
            )}
          >
            <Compass aria-hidden="true" />
          </Link>
        }
      />
      <TooltipContent>Explore this note</TooltipContent>
    </Tooltip>
  );
}
