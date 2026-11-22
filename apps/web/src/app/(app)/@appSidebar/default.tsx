import { Separator } from "@acme/ui/separator";
import { Skeleton } from "@acme/ui/skeleton";
import { Calendar, Compass, Files, Search, Wrench } from "lucide-react";
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
  SidebarMenuButton,
} from "~/components/ui/sidebar";
import { env } from "~/env";
import {
  APP_SIDEBAR_WIDTH_REM_MAX,
  APP_SIDEBAR_WIDTH_REM_MIN,
} from "~/preferences/app-preferences";
import { infiniteSidebarTreeQueryOptions } from "~/trpc/options/sidebar-tree-query-options";
import { prefetch, trpc } from "~/trpc/server";
import { HeaderSearchButton } from "../@header/_components/header-search-modal";
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
    icon: <Files />,
    title: "All pages",
    url: "/library",
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
      <SidebarHeader className="journl-navigation-header">
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
        <div className="flex min-h-11 items-center group-data-[collapsible=icon]:hidden">
          <Brand className="h-7" />
        </div>
      </SidebarHeader>
      <div className="journl-navigation-shortcuts">
        <HeaderSearchButton
          keyboardShortcut={false}
          trigger={
            <SidebarMenuButton
              aria-label="Search workspace"
              aria-keyshortcuts="Control+k Meta+k"
              tooltip="Search"
              className="mb-1 h-9 text-[13px]"
            >
              <Search />
              <span className="group-data-[collapsible=icon]:sr-only">
                Search
              </span>
              <kbd className="ml-auto hidden font-mono text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden min-[701px]:inline-flex">
                ⌘ K
              </kbd>
            </SidebarMenuButton>
          }
        />
        <div className="journl-navigation-create group-data-[collapsible=icon]:hidden">
          <AppSidebarTreeActions
            kind="root"
            parentNodeId={null}
            triggerMode="direct-page"
          />
        </div>
      </div>
      <SidebarContent className="flex flex-1 flex-col overflow-x-clip">
        <SidebarGroup className="journl-navigation-primary flex min-h-0 flex-1 flex-col px-3">
          <SidebarGroupLabel className="journl-navigation-label">
            Workspace
          </SidebarGroupLabel>
          <AppSidebarNavigation items={navigationItems} />
          <Suspense fallback={<AppSidebarPagesSkeleton />}>
            <AppSidebarPages key={owner.id} owner={owner.id} />
          </Suspense>
        </SidebarGroup>
      </SidebarContent>
      {env.NODE_ENV === "development" && (
        <>
          <Separator />
          <SidebarFooter data-development-tools>
            <details>
              <summary
                title="Developer Tools"
                className="cursor-pointer list-none px-2 py-1 text-muted-foreground text-xs"
              >
                <span className="group-data-[collapsible=icon]:sr-only">
                  Developer Tools
                </span>
                <Wrench
                  aria-hidden="true"
                  className="hidden size-4 group-data-[collapsible=icon]:inline"
                />
              </summary>
              <Suspense fallback={<Skeleton />}>
                <DynamicAppSidebarDevtools />
              </Suspense>
            </details>
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
