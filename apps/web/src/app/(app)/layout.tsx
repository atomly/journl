import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";

type AppLayoutProps = {
	children: React.ReactNode;
	// Parallel Routes
	sidebar: React.ReactNode;
	navbar: React.ReactNode;
};

export default function AppLayout({
	children,
	sidebar,
	navbar,
}: AppLayoutProps) {
	return (
		<SidebarProvider className="flex min-h-screen flex-col">
			<div className="flex flex-1">
				{sidebar}
				<SidebarInset>
					{navbar}
					<main className="flex-1 overflow-auto">{children}</main>
				</SidebarInset>
			</div>
		</SidebarProvider>
	);
}
