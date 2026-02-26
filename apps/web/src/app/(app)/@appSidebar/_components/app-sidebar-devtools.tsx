"use client";

import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { Bug } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { SidebarMenu, SidebarMenuButton } from "~/components/ui/sidebar";

const REACT_QUERY_DIALOG_CONTENT_ID = "react-query-devtools-dialog-content";
const REACT_QUERY_DIALOG_TRIGGER_ID = "react-query-devtools-dialog-trigger";

function ReactQueryDevtoolsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild id={REACT_QUERY_DIALOG_TRIGGER_ID}>
        <SidebarMenuButton tooltip="React Query" className="cursor-pointer">
          <Bug className="size-6" />
          <span>React Query</span>
        </SidebarMenuButton>
      </DialogTrigger>
      <DialogContent
        id={REACT_QUERY_DIALOG_CONTENT_ID}
        className="flex h-full w-full max-w-screen-md! items-center justify-center border-none bg-transparent px-0 py-10"
      >
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
