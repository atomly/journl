import { Calendar } from "lucide-react";
import { type ComponentProps, Suspense } from "react";
import { Separator } from "~/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
} from "~/components/ui/sidebar";
import { Skeleton } from "~/components/ui/skeleton";
import { env } from "~/env";
import { infiniteFoldersQueryOptions } from "~/trpc/options/folders-query-options";
import { infinitePagesQueryOptions } from "~/trpc/options/pages-query-options";
import { prefetch, trpc } from "~/trpc/server";
import { DynamicAppSidebarDevtools } from "./_components/app-sidebar-devtools.dynamic";
import { AppSidebarNavigation } from "./_components/app-sidebar-main";
import { AppSidebarPages } from "./_components/app-sidebar-pages";
import { AppSidebarPagesSkeleton } from "./_components/app-sidebar-pages-skeleton";
import { AppSidebarUser } from "./_components/app-sidebar-user";
import { AppSidebarUserSkeleton } from "./_components/app-sidebar-user-skeleton";

const navigationItems = [
  {
    icon: <Calendar />,
    isActive: true,
    title: "Journal",
    url: "/journal",
  },
] satisfies ComponentProps<typeof AppSidebarNavigation>["items"];

export default function AppSidebar() {
  prefetch(
    trpc.folders.getPaginated.infiniteQueryOptions(infiniteFoldersQueryOptions),
  );
  prefetch(
    trpc.pages.getPaginated.infiniteQueryOptions(infinitePagesQueryOptions),
  );
  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        <SidebarGroupLabel>Journl</SidebarGroupLabel>
        <Suspense fallback={<AppSidebarUserSkeleton />}>
          <AppSidebarUser />
        </Suspense>
      </SidebarHeader>
      <Separator />
      <SidebarContent className="flex flex-1 flex-col">
        <SidebarGroup className="flex min-h-0 flex-1 flex-col gap-y-1">
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <AppSidebarNavigation items={navigationItems} />
          <Suspense fallback={<AppSidebarPagesSkeleton />}>
            <AppSidebarPages />
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
    </Sidebar>
  );
}
