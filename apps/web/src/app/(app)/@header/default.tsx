import { Suspense } from "react";
import { SaveStatus } from "~/components/editor/save-status";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { AppHeader } from "./_components/app-header";
import { HeaderRouteActions } from "./_components/header-route-actions";
import { HeaderSearchButton } from "./_components/header-search-modal";
import { HeaderSubscriptionButton } from "./_components/header-subscription-button";

export default function JournalHeader() {
  return (
    <AppHeader className="flex shrink-0 items-center gap-2">
      <div className="flex h-full min-w-0 flex-1 items-center gap-1 rounded-[20px] border border-sidebar-border bg-sidebar p-1 min-[701px]:gap-2 min-[701px]:p-3">
        <SidebarTrigger />
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-0 min-[701px]:gap-x-2">
          <HeaderRouteActions>
            <Suspense>
              <HeaderSubscriptionButton />
            </Suspense>
          </HeaderRouteActions>
          <div
            data-slot="header-actions"
            className="flex shrink-0 items-center gap-x-0 min-[701px]:gap-x-2"
          >
            <SaveStatus />
            <HeaderSearchButton />
          </div>
        </div>
      </div>
    </AppHeader>
  );
}
