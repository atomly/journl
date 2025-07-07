import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ComponentPropsWithoutRef } from "react";
import { auth } from "~/auth/server";
import { Button } from "~/components/ui/button";

type SignOutButtonProps = Omit<
	ComponentPropsWithoutRef<typeof Button>,
	"size" | "variant" | "formAction"
>;

export function SignOutButton({ ...props }: SignOutButtonProps) {
	return (
		<form>
			<Button
				{...props}
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
	);
}
