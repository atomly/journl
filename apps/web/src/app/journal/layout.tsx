import { Calendar, Hash } from "lucide-react";
import { Separator } from "~/components/ui/separator";
import { LayoutProvider } from "../_layout/provider/layout-provider";
import { SidebarHeader } from "../_layout/sidebar/sidebar-header";
import { SidebarScrollArea } from "../_layout/sidebar/sidebar-scroll-area";
import { SidebarSection } from "../_layout/sidebar/sidebar-section";
import { SidebarWrapper } from "../_layout/sidebar/sidebar-wrapper";
import { JournalNavbar } from "./_components/navbar/journal-navbar";

// TODO: Make this dynamic, we could leverage DB or cookie to store this.
const DEFAULT_SIDEBAR_OPEN = true;

type JournalLayoutProps = {
	children: React.ReactNode;
};

export default function JournalLayout({ children }: JournalLayoutProps) {
	return (
		<div className="flex h-screen bg-background">
			<LayoutProvider defaultValue={{ sidebarOpen: DEFAULT_SIDEBAR_OPEN }}>
				{/* Sidebar */}
				<SidebarWrapper>
					<SidebarHeader />
					<SidebarScrollArea>
						{/* Journals Section */}
						<SidebarSection title="Journals">
							<div className="space-y-1">
								<div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
									<Calendar className="mr-2 inline h-4 w-4" />
									Today
								</div>
								<div className="px-3 py-2 text-muted-foreground text-sm">
									Yesterday
								</div>
								<div className="px-3 py-2 text-muted-foreground text-sm">
									Dec 5, 2024
								</div>
							</div>
						</SidebarSection>
						<Separator />
						{/* Pages Section */}
						<SidebarSection title="Pages">
							<div className="space-y-1">
								<div className="px-3 py-2 text-muted-foreground text-sm">
									<Hash className="mr-2 inline h-4 w-4" />
									Ideas
								</div>
								<div className="px-3 py-2 text-muted-foreground text-sm">
									<Hash className="mr-2 inline h-4 w-4" />
									Projects
								</div>
								<div className="px-3 py-2 text-muted-foreground text-sm">
									<Hash className="mr-2 inline h-4 w-4" />
									Reading List
								</div>
							</div>
						</SidebarSection>
					</SidebarScrollArea>
				</SidebarWrapper>

				<div className="flex flex-1 flex-col">
					{/* Header */}
					<JournalNavbar />

					{/* Journal Content */}
					{children}
				</div>
			</LayoutProvider>
		</div>
	);
}
