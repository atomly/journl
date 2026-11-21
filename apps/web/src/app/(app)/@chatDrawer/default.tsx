import { Drawer, DrawerClose, DrawerTitle } from "@acme/ui/drawer";
import { Surface } from "@acme/ui/surface";
import { X } from "lucide-react";
import { ChatPanel } from "~/components/chat/chat-panel";
import { ChatWelcome } from "~/components/chat/welcome";
import { AssistantIdentity } from "../@chatSidebar/_components/chat-panel-chrome";
import { ChatDrawerFrame } from "./_components/chat-drawer-frame";
import { ChatDrawerTrigger } from "./_components/chat-drawer-trigger";

const CHAT_DRAWER_CONTENT_ID = "chat-drawer-content";
export default function ChatDrawer() {
  return (
    <Drawer>
      <ChatDrawerTrigger
        aria-controls={CHAT_DRAWER_CONTENT_ID}
        className="absolute right-[calc(12px+env(safe-area-inset-right,0px))] bottom-[max(22px,env(safe-area-inset-bottom,0px))] z-3 flex min-[701px]:hidden"
      />
      <ChatDrawerFrame>
        <div
          aria-hidden="true"
          className="mx-auto mt-[7px] mb-1 h-1 w-8 shrink-0 rounded bg-[#7387a1] dark:bg-[#8198b9]"
        />
        <Surface
          material="solid"
          className="flex h-[67px] shrink-0 items-center justify-between rounded-none border-x-0 border-t-0 pr-3 pl-4"
        >
          <DrawerTitle className="sr-only">Ask Journl</DrawerTitle>
          <AssistantIdentity />
          <DrawerClose
            aria-label="Close assistant"
            className="flex size-11 items-center justify-center rounded-xl text-muted-foreground"
          >
            <X className="size-4" strokeWidth={1.65} />
          </DrawerClose>
        </Surface>
        <ChatPanel welcome={<ChatWelcome />} />
      </ChatDrawerFrame>
    </Drawer>
  );
}
