import { Button } from "@acme/ui/components/button";
import { SidebarTrigger } from "@acme/ui/components/sidebar";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "~/auth/server";

interface NavbarProps {
	children?: React.ReactNode;
}

export function Navbar({ children }: NavbarProps) {
	return (
		<header className="sticky top-0 z-50 w-full border-border/40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="flex h-14 items-center px-4">
				<div className="flex items-center gap-2">
					<SidebarTrigger />
					<h1 className="font-semibold text-xl">Journl</h1>
				</div>
				<div className="flex-1" />
				<div className="flex items-center gap-2">{children}</div>
			</div>
		</header>
	);
}

export async function AuthControls() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		return (
			<form>
				<Button
					variant="outline"
					size="sm"
					formAction={async () => {
						"use server";
						const res = await auth.api.signInSocial({
							body: {
								callbackURL: "/home",
								provider: "discord",
							},
						});
						if (!res.url) {
							throw new Error("No URL returned from signInSocial");
						}
						redirect(res.url);
					}}
				>
					Sign in
				</Button>
			</form>
		);
	}

	return (
		<div className="flex items-center gap-2">
			<span className="text-muted-foreground text-sm">
				Welcome, {session.user.name}
			</span>
			<form>
				<Button
					variant="outline"
					size="sm"
					formAction={async () => {
						"use server";
						await auth.api.signOut({
							headers: await headers(),
						});
						redirect("/");
					}}
				>
					Sign out
				</Button>
			</form>
		</div>
	);
}
