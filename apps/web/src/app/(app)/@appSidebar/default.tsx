import { Separator } from "@acme/ui/separator";
import { Skeleton } from "@acme/ui/skeleton";
import { Calendar, Compass } from "lucide-react";
import Image from "next/image";
import { type ComponentProps, Suspense } from "react";
import { getUser } from "~/auth/server";
import { Brand } from "~/components/brand";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
} from "~/components/ui/sidebar";
import { env } from "~/env";
import {
  APP_SIDEBAR_WIDTH_REM_MAX,
  APP_SIDEBAR_WIDTH_REM_MIN,
} from "~/preferences/app-preferences";
import { infiniteSidebarTreeQueryOptions } from "~/trpc/options/sidebar-tree-query-options";
import { prefetch, trpc } from "~/trpc/server";
import { DynamicAppSidebarDevtools } from "./_components/app-sidebar-devtools.dynamic";
import { AppSidebarNavigation } from "./_components/app-sidebar-main";
import { AppSidebarPages } from "./_components/app-sidebar-pages";
import { AppSidebarPagesSkeleton } from "./_components/app-sidebar-pages-skeleton";
import { NavigationSidebarClose } from "./_components/app-sidebar-provider";
import { AppSidebarTreeActions } from "./_components/app-sidebar-tree-actions";
import { AppSidebarUser } from "./_components/app-sidebar-user";
import { AppSidebarUserSkeleton } from "./_components/app-sidebar-user-skeleton";

const navigationItems = [
  {
    icon: <Calendar />,
    isActive: true,
    title: "Journal",
    url: "/journal",
  },
  {
    icon: <Compass />,
    title: "Explore",
    url: "/explore",
  },
] satisfies ComponentProps<typeof AppSidebarNavigation>["items"];

export default async function AppSidebar() {
  const owner = await getUser();
  prefetch(
    trpc.tree.getChildrenPaginated.infiniteQueryOptions(
      infiniteSidebarTreeQueryOptions,
      {
        getNextPageParam: ({ nextCursor }) => nextCursor ?? undefined,
      },
    ),
  );
  return (
    <Sidebar
      collapsible="icon"
      variant="floating"
      minWidth={`${APP_SIDEBAR_WIDTH_REM_MIN}rem`}
      maxWidth={`${APP_SIDEBAR_WIDTH_REM_MAX}rem`}
    >
      <SidebarHeader>
        <NavigationSidebarClose />
        <span className="journl-brand mx-auto hidden size-8 group-data-[collapsible=icon]:block">
          <Image
            unoptimized
            width={32}
            height={32}
            className="brand-light"
            src="/brand/mark-light.svg"
            alt="Journl"
          />
          <Image
            unoptimized
            width={32}
            height={32}
            className="brand-dark hidden"
            src="/brand/mark-dark.svg"
            alt="Journl"
          />
          <span
            className="brand-system hidden"
            role="img"
            aria-label="Journl"
          />
        </span>
        <div className="px-3 pt-6 pb-[21px] group-data-[collapsible=icon]:hidden">
          <Brand className="relative -top-0.5 h-10" />
        </div>
      </SidebarHeader>
      <div className="px-3 pb-4 group-data-[collapsible=icon]:hidden [&>button]:h-11 [&>button]:min-h-11">
        <AppSidebarTreeActions
          kind="root"
          parentNodeId={null}
          triggerMode="direct-page"
        />
      </div>
      <SidebarContent className="flex flex-1 flex-col overflow-x-clip">
        <SidebarGroup className="flex min-h-0 flex-1 flex-col gap-y-2 px-3">
          <AppSidebarNavigation items={navigationItems} />
          <Suspense fallback={<AppSidebarPagesSkeleton />}>
            <AppSidebarPages key={owner.id} owner={owner.id} />
          </Suspense>
        </SidebarGroup>
      </SidebarContent>
      {env.NODE_ENV === "development" && (
        <>
          <Separator />
          <SidebarFooter>
            <SidebarGroupLabel>Developer Tools</SidebarGroupLabel>
            <Suspense fallback={<Skeleton />}>
              <DynamicAppSidebarDevtools />
            </Suspense>
          </SidebarFooter>
        </>
      )}
      <SidebarFooter className="px-3 pb-5">
        <Suspense fallback={<AppSidebarUserSkeleton />}>
          <AppSidebarUser />
        </Suspense>
      </SidebarFooter>
    </Sidebar>
  );
}
