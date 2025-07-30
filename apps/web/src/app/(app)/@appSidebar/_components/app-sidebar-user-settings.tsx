"use client";
import { Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { useAuthModal } from "~/components/auth/auth-modal-provider";

type AppSidebarUserSettingsProps = ComponentProps<"button">;

export function AppSidebarUserSettings(props: AppSidebarUserSettingsProps) {
	const pathname = usePathname();
	const { setCancelUrl } = useAuthModal();
	return (
		<button type="button" {...props}>
			<Link
				className="flex w-full items-center gap-x-2"
				href="/auth/settings"
				onClick={() => {
					setCancelUrl(pathname);
				}}
			>
				<Settings />
				Settings
			</Link>
		</button>
	);
}
