import { Toaster } from "@acme/ui/toast";
import { withAuth } from "~/app/_guards/page-guards";
import { getUser } from "~/auth/server";
import { SidebarInset } from "~/components/ui/sidebar";
import { getAppPreferences } from "~/preferences/get-preferences";
import "./styles.css";
import { AppLayoutProvider } from "../_components/app-layout-provider";
import { AppProviders } from "../_components/app-providers";
import { AppSidebarProvider } from "./@appSidebar/_components/app-sidebar-provider";
import { ChatSidebarProvider } from "./@chatSidebar/_components/chat-sidebar-provider";
import ChatSidebarTrigger from "./@chatSidebar/_components/chat-sidebar-trigger";
import { AppContainer } from "./_components/app-container";
import { AppProgressBar } from "./_components/app-progress-bar";

type AppLayoutProps = {
  children: React.ReactNode;
  // Parallel Routes
  appSidebar: React.ReactNode;
  chatDrawer: React.ReactNode;
  chatSidebar: React.ReactNode;
  header: React.ReactNode;
  subscriptionModal: React.ReactNode;
};

async function AppLayout({
  children,
  appSidebar,
  chatDrawer,
  chatSidebar,
  header,
  subscriptionModal,
}: AppLayoutProps) {
  const [preferences, owner] = await Promise.all([
    getAppPreferences(),
    getUser(),
  ]);

  return (
    <AppProviders initialPreferences={preferences} owner={owner.id}>
      <AppProgressBar className="fixed top-0 left-0 z-4 h-1 w-full" />
      <AppSidebarProvider>
        {appSidebar}
        <SidebarInset className="flex max-h-dvh min-w-0 flex-col gap-y-4">
          <AppLayoutProvider>
            {header}
            <ChatSidebarProvider className="relative min-h-0 flex-1">
              <AppContainer className="min-h-0 min-w-54 flex-1 overflow-auto [--app-header-offset:0px]">
                {children}
              </AppContainer>
              {chatSidebar}
              <ChatSidebarTrigger className="absolute right-[calc(25px+env(safe-area-inset-right,0px))] bottom-[calc(25px+env(safe-area-inset-bottom,0px))] z-3 hidden min-[701px]:flex" />
              {chatDrawer}
            </ChatSidebarProvider>
          </AppLayoutProvider>
        </SidebarInset>
      </AppSidebarProvider>
      {subscriptionModal}
      <Toaster />
    </AppProviders>
  );
}

export default withAuth(AppLayout);
