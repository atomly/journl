import {
  Drawer,
  DrawerContent,
  DrawerDivider,
  DrawerTitle,
} from "@acme/ui/drawer";
import { ChatPanel } from "~/components/chat/chat-panel";
import { ChatWelcome } from "~/components/chat/welcome";
import { ChatDrawerTrigger } from "./_components/chat-drawer-trigger";

const CHAT_DRAWER_CONTENT_ID = "chat-drawer-content";
export default function ChatDrawer() {
  return (
    <Drawer>
      <ChatDrawerTrigger
        aria-controls={CHAT_DRAWER_CONTENT_ID}
        className="fixed right-[calc(1rem+env(safe-area-inset-right,0px))] bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-4500 flex md:hidden"
      />
      <DrawerContent
        id={CHAT_DRAWER_CONTENT_ID}
        className="z-4500 h-full! max-h-[90dvh]! transition-[bottom] duration-200 ease-out motion-reduce:transition-none"
      >
        <DrawerTitle className="sr-only">Journl chat</DrawerTitle>
        <DrawerDivider />
        <ChatPanel welcome={<ChatWelcome />} />
      </DrawerContent>
    </Drawer>
  );
}
