import { withAuth } from "~/auth/utils";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { HydrateClient } from "~/trpc/server";

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
		<HydrateClient>
			{/* The outer SidebarProvider controls the Chat sidebar,
			    while the inner SidebarProvider controls the Journal sidebar. */}
			<SidebarProvider className="flex min-h-screen flex-col">
				<div className="flex flex-1">
					<SidebarProvider>
						{appSidebar}
						<SidebarInset>
							{header}
							<div className="flex-1 overflow-auto">{children}</div>
							{chatDrawer}
						</SidebarInset>
					</SidebarProvider>
					{chatSidebar}
				</div>
			</SidebarProvider>
		</HydrateClient>
	);
}

export default withAuth(AppLayout);
