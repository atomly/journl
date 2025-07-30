import { ChevronsUpDown } from "lucide-react";
import { getUser } from "~/auth/server";
import { Avatar, AvatarImage } from "~/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "~/components/ui/sidebar";
import {
	AppSidebarUserEmail,
	AppSidebarUserInformation,
	AppSidebarUsername,
} from "./app-sidebar-user-information";
import { AppSidebarUserMenu } from "./app-sidebar-user-menu";
import { AppSidebarUserSettings } from "./app-sidebar-user-settings";
import { AppSidebarUserSignOut } from "./app-sidebar-user-sign-out";

export async function AppSidebarUser() {
	const user = await getUser();

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<Avatar className="h-8 w-8 rounded-lg">
								{user.image ? (
									<AvatarImage src={user.image} alt={user.name} />
								) : (
									<AppSidebarUserInformation />
								)}
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<AppSidebarUsername />
								<AppSidebarUserEmail />
							</div>
							<ChevronsUpDown className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<AppSidebarUserMenu
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
										<AppSidebarUserInformation />
									)}
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<AppSidebarUsername />
									<AppSidebarUserEmail />
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild className="w-full cursor-pointer">
							<AppSidebarUserSettings />
						</DropdownMenuItem>
						<DropdownMenuItem asChild className="w-full cursor-pointer">
							<AppSidebarUserSignOut />
						</DropdownMenuItem>
					</AppSidebarUserMenu>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
