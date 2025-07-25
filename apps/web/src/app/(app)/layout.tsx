import { ThemeProvider } from "next-themes";
import { withAuth } from "~/auth/utils";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { Toaster } from "~/components/ui/toast";
import { TRPCReactProvider } from "~/trpc/react";
import ChatSidebarTrigger from "./@chatSidebar/_components/chat-sidebar-trigger";

type AppLayoutProps = {
	children: React.ReactNode;
	// Parallel Routes
	appSidebar: React.ReactNode;
	chatDrawer: React.ReactNode;
	chatSidebar: React.ReactNode;
	header: React.ReactNode;
};

function AppLayout({
	children,
	appSidebar,
	chatDrawer,
	chatSidebar,
	header,
}: AppLayoutProps) {
	return (
		<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
			<TRPCReactProvider>
				<SidebarProvider className="flex min-h-screen-safe flex-col">
					<div className="flex flex-1">
						<SidebarProvider defaultOpen={false}>
							{appSidebar}
							<SidebarInset className="flex max-h-svh flex-col">
								{header}
								<div className="min-w-54 flex-1 overflow-auto">{children}</div>
								<div className="mt-auto">{chatDrawer}</div>
							</SidebarInset>
						</SidebarProvider>
						{chatSidebar}
						<ChatSidebarTrigger />
					</div>
				</SidebarProvider>
			</TRPCReactProvider>
			<Toaster />
		</ThemeProvider>
	);
}

export default withAuth(AppLayout);
