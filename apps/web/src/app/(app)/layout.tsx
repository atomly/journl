import { withAuth } from "~/auth/guards";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { Toaster } from "~/components/ui/toast";
import { getAppPreferences } from "~/preferences/get-preferences";
import ChatSidebarTrigger from "./@chatSidebar/_components/chat-sidebar-trigger";
import "./globals.css";
import { AppProviders } from "../_components/app-providers";

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
      <SidebarProvider className="flex min-h-screen-safe flex-col">
        <div className="flex flex-1">
          <SidebarProvider>
            {appSidebar}
            <SidebarInset className="flex max-h-svh min-w-sm flex-col">
              {header}
              <div className="min-w-54 flex-1 overflow-auto">{children}</div>
              <div className="mt-auto">{chatDrawer}</div>
            </SidebarInset>
          </SidebarProvider>
          {chatSidebar}
          <ChatSidebarTrigger />
        </div>
      </SidebarProvider>
      {subscriptionModal}
      <Toaster />
    </AppProviders>
  );
}

export default withAuth(AppLayout);
