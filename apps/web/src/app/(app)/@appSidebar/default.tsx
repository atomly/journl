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
import { api } from "~/trpc/server";
import { DynamicAppSidebarDevtools } from "./_components/app-sidebar-devtools.dynamic";
import { AppSidebarNavigation } from "./_components/app-sidebar-main";
import { AppSidebarPages } from "./_components/app-sidebar-pages";
import { AppSidebarPagesSkeleton } from "./_components/app-sidebar-pages-skeleton";
import { AppSidebarUser } from "./_components/app-sidebar-user";
import { AppSidebarUserSkeleton } from "./_components/app-sidebar-user-skeleton";

async function SuspendedAppSidebarPages() {
  const pages = await api.pages.getByUser();
  return <AppSidebarPages initialPages={pages} />;
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
      <SidebarContent>
        <SidebarGroup className="gap-y-1">
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
