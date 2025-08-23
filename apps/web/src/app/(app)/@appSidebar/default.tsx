import { Calendar } from "lucide-react";
import { type ComponentProps, Suspense } from "react";
import { Separator } from "~/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
} from "~/components/ui/sidebar";
import { api } from "~/trpc/server";
import { AppSidebarNavigation } from "./_components/app-sidebar-main";
import { AppSidebarPages } from "./_components/app-sidebar-pages";
import { AppSidebarPagesSkeleton } from "./_components/app-sidebar-pages-skeleton";
import { AppSidebarUser } from "./_components/app-sidebar-user";
import { AppSidebarUserSkeleton } from "./_components/app-sidebar-user-skeleton";

async function SuspendedAppSidebarPages() {
  const pages = await api.pages.getAll();
  return <AppSidebarPages pages={pages} />;
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
        <Suspense fallback={<AppSidebarUserSkeleton />}>
          <AppSidebarUser />
        </Suspense>
        <Separator />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="gap-y-1">
          <AppSidebarNavigation items={navigationItems} />
          <Suspense fallback={<AppSidebarPagesSkeleton />}>
            <SuspendedAppSidebarPages />
          </Suspense>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
