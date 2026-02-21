"use server";

import { cookies } from "next/headers";
import { withAuthGuard } from "~/auth/guards";
import {
  APP_PREFERENCES_COOKIE_MAX_AGE,
  APP_PREFERENCES_COOKIE_NAME,
  type AppPreferences,
  normalizeAppPreferences,
  serializeAppPreferences,
} from "~/preferences/app-preferences";

export const setAppPreferencesAction = withAuthGuard(
  async (_ctx, preferences: AppPreferences): Promise<AppPreferences> => {
    const normalized = normalizeAppPreferences(preferences);
    const encoded = encodeURIComponent(serializeAppPreferences(normalized));
    const cookieStore = await cookies();

    cookieStore.set(APP_PREFERENCES_COOKIE_NAME, encoded, {
      maxAge: APP_PREFERENCES_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
    });

    return normalized;
  },
);
