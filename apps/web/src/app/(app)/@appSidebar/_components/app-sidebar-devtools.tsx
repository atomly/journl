"use client";

import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { Bug } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { SidebarMenu, SidebarMenuButton } from "~/components/ui/sidebar";

function ReactQueryDevtoolsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <SidebarMenuButton tooltip="React Query" className="cursor-pointer">
          <Bug className="size-6" />
          <span>React Query</span>
        </SidebarMenuButton>
      </DialogTrigger>
      <DialogContent className="flex h-full w-full max-w-3xl! items-center justify-center border-none bg-transparent px-0 py-10">
        <ReactQueryDevtoolsPanel
          style={{
            backgroundColor: "transparent",
            borderRadius: "1rem",
            height: "100%",
            width: "100%",
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export function AppSidebarDevtools() {
  return (
    <SidebarMenu>
      <ReactQueryDevtoolsDialog />
    </SidebarMenu>
  );
}
