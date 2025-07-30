"use server";
import { redirect } from "next/navigation";

export async function serverRedirect(href: string) {
	redirect(href);
}
