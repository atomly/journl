import { ChevronsUpDown } from "lucide-react";
import { getUser } from "~/auth/server";
import { Avatar, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar";
import { api } from "~/trpc/server";
import { AppSidebarManageSubscription } from "./app-sidebar-manage-subscription";
import {
  AppSidebarUserEmail,
  AppSidebarUserInformation,
  AppSidebarUsername,
} from "./app-sidebar-user-information";
import { AppSidebarUserMenu } from "./app-sidebar-user-menu";
import { AppSidebarUserSettings } from "./app-sidebar-user-settings";
import { AppSidebarUserSignOut } from "./app-sidebar-user-sign-out";

export async function AppSidebarUser() {
  const [user, subscription] = await Promise.all([
    getUser(),
    api.subscription.getSubscription(),
  ]);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild id="app-sidebar-user-menu-trigger">
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                {user.image ? (
                  <AvatarImage src={user.image} alt={user.name} />
                ) : (
                  <AppSidebarUserInformation name={user.name} />
                )}
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <AppSidebarUsername name={user.name} />
                <AppSidebarUserEmail email={user.email} />
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <AppSidebarUserMenu
            data-name="app-sidebar-user-menu"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {user.image ? (
                    <AvatarImage src={user.image} alt={user.name} />
                  ) : (
                    <AppSidebarUserInformation name={user.name} />
                  )}
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <AppSidebarUsername name={user.name} />
                  <AppSidebarUserEmail email={user.email} />
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <AppSidebarUserSettings />
            <AppSidebarManageSubscription subscription={subscription} />
            <DropdownMenuSeparator />
            <AppSidebarUserSignOut />
          </AppSidebarUserMenu>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
