import { ChevronsUpDown } from "lucide-react";
import { getUser } from "~/auth/server";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
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
import { AppSidebarSignOut } from "./app-sidebar-sign-out";
import { AppSidebarUserMenu } from "./app-sidebar-user-menu";

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
									<AvatarFallback className="rounded-lg">
										{user.name?.charAt(0)}
									</AvatarFallback>
								)}
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">{user.name}</span>
								<span className="truncate text-xs">{user.email}</span>
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
										<AvatarFallback className="rounded-lg">
											{user.name?.charAt(0)}
										</AvatarFallback>
									)}
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-medium">{user.name}</span>
									<span className="truncate text-xs">{user.email}</span>
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild className="w-full cursor-pointer">
							<AppSidebarSignOut />
						</DropdownMenuItem>
					</AppSidebarUserMenu>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
