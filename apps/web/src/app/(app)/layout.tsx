import { withAuth } from "~/app/_guards/page-guards";
import { SidebarInset } from "~/components/ui/sidebar";
import { Toaster } from "~/components/ui/toast";
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
  const preferences = await getAppPreferences();

  return (
    <AppProviders initialPreferences={preferences}>
      <AppProgressBar className="fixed top-0 left-0 z-7000 h-1 w-full" />
      <ChatSidebarProvider className="flex min-h-screen-safe flex-col">
        <div className="flex flex-1">
          <AppSidebarProvider>
            {appSidebar}
            <SidebarInset className="flex max-h-dvh min-w-sm flex-col gap-y-2">
              <AppLayoutProvider>
                {header}
                <AppContainer className="min-w-54 flex-1 overflow-auto">
                  {children}
                </AppContainer>
                <div className="mt-auto">{chatDrawer}</div>
              </AppLayoutProvider>
            </SidebarInset>
          </AppSidebarProvider>
          {chatSidebar}
          <ChatSidebarTrigger className="fixed right-2 bottom-2 z-4500 hidden md:flex" />
        </div>
      </ChatSidebarProvider>
      {subscriptionModal}
      <Toaster />
    </AppProviders>
  );
}

export default withAuth(AppLayout);
