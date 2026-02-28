"use client";

import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { Bug, TicketPlus } from "lucide-react";
import { InviteDeveloperTool } from "~/components/auth/invite-developer-tool";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { SidebarMenu, SidebarMenuButton } from "~/components/ui/sidebar";

export function AppSidebarDevtools() {
  return (
    <SidebarMenu>
      <InviteCodeToolDialog />
      <ReactQueryDevtoolsDialog />
    </SidebarMenu>
  );
}

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
        <DialogTitle className="sr-only">React Query</DialogTitle>
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

function InviteCodeToolDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <SidebarMenuButton tooltip="Invite Codes" className="cursor-pointer">
          <TicketPlus className="size-6" />
          <span>Invite Codes</span>
        </SidebarMenuButton>
      </DialogTrigger>
      <DialogContent className="w-full max-w-2xl border bg-background p-4">
        <DialogTitle className="sr-only">Invite Codes</DialogTitle>
        <InviteDeveloperTool />
      </DialogContent>
    </Dialog>
  );
}
