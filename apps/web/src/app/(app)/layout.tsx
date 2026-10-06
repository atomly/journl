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
                <AppContainer className="min-h-0 min-w-54 flex-1 overflow-auto [--app-header-offset:4rem] peer-[[data-hidden=true]:not(:has(:focus-visible))]/app-header:[--app-header-offset:0px] md:[--app-header-offset:0px]">
                  {/* A scrolling spacer avoids resizing the viewport or offsetting sticky editor toolbars with container padding. */}
                  <div aria-hidden className="h-16 md:hidden" />
                  {children}
                </AppContainer>
                <div className="mt-auto">{chatDrawer}</div>
              </AppLayoutProvider>
            </SidebarInset>
          </AppSidebarProvider>
          {chatSidebar}
          <ChatSidebarTrigger className="fixed right-[calc(1rem+env(safe-area-inset-right,0px))] bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-4500 hidden md:flex" />
        </div>
      </ChatSidebarProvider>
      {subscriptionModal}
      <Toaster />
    </AppProviders>
  );
}

export default withAuth(AppLayout);
