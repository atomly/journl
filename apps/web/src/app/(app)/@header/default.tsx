import { Suspense } from "react";
import { HeaderThemeToggle } from "~/app/(app)/@header/_components/header-theme-toggle";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { FixedHeader } from "./_components/fixed-header";
import { HeaderJournalButton } from "./_components/header-journal-button";
import { HeaderSearchButton } from "./_components/header-search-modal";
import { HeaderSearchTrigger } from "./_components/header-search-trigger";
import { HeaderSubscriptionButton } from "./_components/header-subscription-button";

export default function JournalHeader() {
  return (
    <FixedHeader className="flex shrink-0 items-center gap-2">
      <div className="flex flex-1 items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar p-2">
        <SidebarTrigger />
        <div className="flex w-full items-center justify-between gap-x-2">
          <HeaderJournalButton />
          <div className="@container flex w-full flex-1 justify-end gap-x-2">
            <Suspense>
              <HeaderSubscriptionButton />
            </Suspense>
            <HeaderSearchButton>
              <HeaderSearchTrigger />
            </HeaderSearchButton>
            <HeaderThemeToggle />
          </div>
        </div>
      </div>
    </FixedHeader>
  );
}
