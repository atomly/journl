import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "~/auth/server";

export async function signOutAction() {
	"use server";
	await auth.api.signOut({
		headers: await headers(),
	});
	redirect("/");
}
