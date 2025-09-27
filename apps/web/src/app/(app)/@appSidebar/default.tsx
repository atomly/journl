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
import { prefetch, trpc } from "~/trpc/server";
import { infinitePagesQueryOptions } from "../../api/trpc/options/pages-query-options";
import { DynamicAppSidebarDevtools } from "./_components/app-sidebar-devtools.dynamic";
import { AppSidebarNavigation } from "./_components/app-sidebar-main";
import { AppSidebarPages } from "./_components/app-sidebar-pages";
import { AppSidebarPagesSkeleton } from "./_components/app-sidebar-pages-skeleton";
import { AppSidebarUser } from "./_components/app-sidebar-user";
import { AppSidebarUserSkeleton } from "./_components/app-sidebar-user-skeleton";

async function SuspendedAppSidebarPages() {
  prefetch(
    trpc.pages.getPaginated.infiniteQueryOptions(infinitePagesQueryOptions),
  );
  return (
    <AppSidebarPages infinitePagesQueryOptions={infinitePagesQueryOptions} />
  );
}

export default function AppSidebar() {
  const navigationItems = [
    {
      icon: <Calendar />,
      isActive: true,
      title: "Journal",
      url: "/journal",
    },
  ] satisfies ComponentProps<typeof AppSidebarNavigation>["items"];
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
            <SuspendedAppSidebarPages />
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
