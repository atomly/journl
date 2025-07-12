"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "~/auth/server";
import { api } from "~/trpc/server";

export async function deletePageAction(pageId: string) {
	const session = await getSession();

	if (!session?.user.id) {
		throw new Error("User not authenticated");
	}

	const deletedPage = await api.pages.delete({ id: pageId });

	revalidatePath("/(app)", "layout");

	return deletedPage;
}
