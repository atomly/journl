import { SidebarTrigger } from "~/components/ui/sidebar";
import { CurrentDateTitle } from "./_components/current-date-title";
import { SearchNotesButton } from "./_components/search-notes-button";

export default function JournalHeader() {
	return (
		<header className="sticky top-0 flex shrink-0 items-center gap-2 p-2">
			<div className="flex h-12 flex-1 items-center gap-2 rounded-lg border bg-sidebar px-3">
				<SidebarTrigger />
				<div className="flex w-full items-center justify-between gap-x-2">
					<div className="min-w-0 flex-1">
						<CurrentDateTitle />
					</div>
					<SearchNotesButton />
				</div>
			</div>
		</header>
	);
}
