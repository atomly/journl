import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { CurrentDate } from "./_components/current-date";
import { SearchForm } from "./_components/search-form";

export default function JournalHeader() {
	return (
		<header className="sticky top-0 flex shrink-0 items-center gap-2 p-2">
			<div className="flex h-12 flex-1 items-center gap-2 rounded-lg border bg-sidebar px-3">
				<SidebarTrigger />
				<div className="flex w-full items-center justify-between gap-12">
					<Breadcrumb className="shrink-0">
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbPage className="line-clamp-1">
									<CurrentDate />
								</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
					<SearchForm className="w-full sm:ml-auto sm:w-auto" />
				</div>
			</div>
		</header>
	);
}
