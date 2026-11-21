import { ChatPanel } from "~/components/chat/chat-panel";
import { ChatWelcome } from "~/components/chat/welcome";
import { SidebarContent } from "~/components/ui/sidebar";
import { ChatPanelChrome } from "./_components/chat-panel-chrome";
import { ChatSidebarFrame } from "./_components/chat-sidebar-frame";

export default function ChatSidebar() {
  return (
    <ChatSidebarFrame>
      <ChatPanelChrome />
      <SidebarContent className="overflow-hidden bg-transparent">
        <ChatPanel welcome={<ChatWelcome />} />
      </SidebarContent>
    </ChatSidebarFrame>
  );
}
