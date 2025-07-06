import { SidebarInset, SidebarProvider } from "@acme/ui/components/sidebar";
import { AppSidebar } from "./_components/app-sidebar";
import { AuthControls, Navbar } from "./_components/navbar";

export default async function ClientLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<SidebarProvider className="flex min-h-screen flex-col">
			<Navbar>
				<AuthControls />
			</Navbar>
			<div className="flex flex-1">
				<AppSidebar variant="with-navbar" />
				<SidebarInset>
					<main className="flex-1 overflow-auto">{children}</main>
				</SidebarInset>
			</div>
		</SidebarProvider>
	);
}
