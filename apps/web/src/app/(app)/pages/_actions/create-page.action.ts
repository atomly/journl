"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "~/auth/server";
import { api } from "~/trpc/server";

export async function createPageAction() {
	const session = await getSession();

	if (!session?.user.id) {
		throw new Error("User not authenticated");
	}

	const newPage = await api.pages.create({
		children: [],
		title: "New Page",
		user_id: session.user.id,
	});

	if (!newPage) {
		throw new Error("Failed to create page");
	}

	// Invalidate the layout cache to refresh any server-side cached data
	revalidatePath("/(app)", "layout");

	return newPage;
}
