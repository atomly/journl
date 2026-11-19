import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDivider,
  DrawerTitle,
} from "@acme/ui/drawer";
import { Surface } from "@acme/ui/surface";
import { X } from "lucide-react";
import { ChatPanel } from "~/components/chat/chat-panel";
import { ChatWelcome } from "~/components/chat/welcome";
import { AssistantIdentity } from "../@chatSidebar/_components/chat-panel-chrome";
import { ChatDrawerTrigger } from "./_components/chat-drawer-trigger";

const CHAT_DRAWER_CONTENT_ID = "chat-drawer-content";
export default function ChatDrawer() {
  return (
    <Drawer>
      <ChatDrawerTrigger
        aria-controls={CHAT_DRAWER_CONTENT_ID}
        className="fixed right-[calc(1rem+env(safe-area-inset-right,0px))] bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-3 flex min-[701px]:hidden"
      />
      <DrawerContent
        id={CHAT_DRAWER_CONTENT_ID}
        className="inset-x-3! bottom-3! h-full! max-h-[calc(100dvh-24px)]! overflow-hidden rounded-3xl bg-card transition-[bottom] duration-200 ease-out motion-reduce:transition-none"
      >
        <Surface
          material="glass"
          className="flex h-20 shrink-0 items-center justify-between rounded-none border-x-0 border-t-0 px-4"
        >
          <DrawerTitle className="sr-only">Ask Journl</DrawerTitle>
          <AssistantIdentity />
          <DrawerClose
            aria-label="Close assistant"
            className="flex size-11 items-center justify-center rounded-xl"
          >
            <X />
          </DrawerClose>
        </Surface>
        <DrawerDivider />
        <ChatPanel welcome={<ChatWelcome />} />
      </DrawerContent>
    </Drawer>
  );
}
