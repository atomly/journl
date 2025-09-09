import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { HeaderThemeToggle } from "~/app/(app)/@header/_components/header-theme-toggle";
import { auth, getUser } from "~/auth/server";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { HeaderCurrentDate } from "./_components/header-current-date";
import { HeaderSearchButton } from "./_components/header-search-modal";
import { HeaderSearchTrigger } from "./_components/header-search-trigger";
import { HeaderUpgradePro } from "./_components/header-upgrade-pro";

async function UpgradeProButton() {
  const user = await getUser();

  const subscriptions = await auth.api.listActiveSubscriptions({
    headers: await headers(),
    query: {
      referenceId: user.id,
    },
  });

  // get the active subscription
  const activeSubscription = subscriptions.find(
    (sub) => sub.status === "active" || sub.status === "trialing",
  );

  return <HeaderUpgradePro activeSubscription={activeSubscription} />;
}

export default function JournalHeader() {
  return (
    <header className="sticky top-0 flex shrink-0 items-center gap-2 p-2">
      <div className="flex h-12 flex-1 items-center gap-2 rounded-lg border bg-sidebar px-3">
        <SidebarTrigger />
        <div className="flex w-full items-center justify-between gap-x-2">
          <div className="min-w-0 flex-1">
            <Link href="/journal">
              <HeaderCurrentDate />
            </Link>
          </div>
          <div className="@container flex w-full flex-1 justify-end gap-x-2">
            <Suspense>
              <UpgradeProButton />
            </Suspense>
            <HeaderSearchButton>
              <HeaderSearchTrigger />
            </HeaderSearchButton>
            <HeaderThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
