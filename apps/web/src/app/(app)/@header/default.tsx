import { HeaderThemeToggle } from "~/app/(app)/@header/_components/header-theme-toggle";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { HeaderCurrentDate } from "./_components/header-current-date";
import { HeaderSearchButton } from "./_components/header-search-modal";
import { HeaderSearchTrigger } from "./_components/header-search-trigger";

export default function JournalHeader() {
  return (
    <header className="sticky top-0 flex shrink-0 items-center gap-2 p-2">
      <div className="flex h-12 flex-1 items-center gap-2 rounded-lg border bg-sidebar px-3">
        <SidebarTrigger />
        <div className="flex w-full items-center justify-between gap-x-2">
          <div className="min-w-0 flex-1">
            <HeaderCurrentDate />
          </div>
          <HeaderSearchButton>
            <HeaderSearchTrigger />
          </HeaderSearchButton>
          <HeaderThemeToggle />
        </div>
      </div>
    </header>
  );
}
