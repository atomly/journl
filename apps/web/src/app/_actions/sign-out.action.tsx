"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withAuthGuard } from "~/auth/guards";
import { auth } from "~/auth/server";

export const signOutAction = withAuthGuard(async () => {
  await auth.api.signOut({
    headers: await headers(),
  });
  redirect("/");
});
