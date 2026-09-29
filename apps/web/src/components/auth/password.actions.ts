"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "~/auth/server";

export type PasswordActionState = {
  error?: string;
  success?: boolean;
};

const passwordSchema = z
  .object({
    confirmPassword: z.string(),
    currentPassword: z.string().max(128).optional(),
    newPassword: z.string().min(8).max(128),
  })
  .refine((value) => value.newPassword === value.confirmPassword);

export async function savePasswordAction(
  _previousState: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const input = passwordSchema.safeParse({
    confirmPassword: formData.get("confirmPassword"),
    currentPassword: formData.get("currentPassword") ?? undefined,
    newPassword: formData.get("newPassword"),
  });
  if (!input.success) {
    return {
      error: "Use 8–128 characters and make sure your new passwords match.",
    };
  }

  try {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({
      headers: requestHeaders,
      query: { disableCookieCache: true },
    });
    if (!session) {
      return { error: "Sign in to manage your password." };
    }

    const accounts: { providerId: string }[] = await auth.api.listUserAccounts({
      headers: requestHeaders,
    });
    const hasPassword = accounts.some(
      (account) => account.providerId === "credential",
    );
    if (hasPassword) {
      if (!input.data.currentPassword) {
        return { error: "Enter your current password to change it." };
      }
      await auth.api.changePassword({
        body: {
          currentPassword: input.data.currentPassword,
          newPassword: input.data.newPassword,
        },
        headers: requestHeaders,
      });
    } else {
      // Adding a new login method requires a recent sign-in, not a refreshed session.
      const age = Date.now() - new Date(session.session.createdAt).getTime();
      if (!Number.isFinite(age) || age < 0 || age >= 15 * 60 * 1000) {
        return {
          error: "Sign out and sign in again before setting your password.",
        };
      }
      await auth.api.setPassword({
        body: { newPassword: input.data.newPassword },
        headers: requestHeaders,
      });
    }
  } catch (error) {
    if (error instanceof APIError) {
      if (error.body?.code === "INVALID_PASSWORD") {
        return { error: "Your current password is incorrect." };
      }
      if (error.status === "UNAUTHORIZED") {
        return { error: "Sign in again to manage your password." };
      }
    }
    return { error: "Could not save your password. Please try again." };
  }

  revalidatePath("/account/security");
  return { success: true };
}
