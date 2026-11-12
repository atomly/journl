import { ChatPanel } from "~/components/chat/chat-panel";
import { ChatWelcome } from "~/components/chat/welcome";
import { Sidebar, SidebarContent } from "~/components/ui/sidebar";
import {
  CHAT_SIDEBAR_WIDTH_REM_DEFAULT,
  CHAT_SIDEBAR_WIDTH_REM_MAX,
  CHAT_SIDEBAR_WIDTH_REM_MIN,
} from "~/preferences/app-preferences";

const CHAT_SIDEBAR_DEFAULT_WIDTH = `${CHAT_SIDEBAR_WIDTH_REM_DEFAULT}rem`;
const CHAT_SIDEBAR_MIN_WIDTH = `${CHAT_SIDEBAR_WIDTH_REM_MIN}rem`;
const CHAT_SIDEBAR_WIDTH_MAX = `${CHAT_SIDEBAR_WIDTH_REM_MAX}rem`;
export default function ChatSidebar() {
  return (
    <Sidebar
      side="right"
      collapsible="offcanvas"
      variant="floating"
      className="sticky top-0 h-svh"
      defaultWidth={CHAT_SIDEBAR_DEFAULT_WIDTH}
      minWidth={CHAT_SIDEBAR_MIN_WIDTH}
      maxWidth={CHAT_SIDEBAR_WIDTH_MAX}
    >
      <SidebarContent className="overflow-hidden">
        <ChatPanel welcome={<ChatWelcome />} />
      </SidebarContent>
    </Sidebar>
  );
}
