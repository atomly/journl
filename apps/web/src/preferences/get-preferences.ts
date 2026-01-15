import { cookies } from "next/headers";
import {
  APP_PREFERENCES_COOKIE_NAME,
  parseAppPreferences,
} from "./app-preferences";

export async function getAppPreferences() {
  const cookieStore = await cookies();
  const rawPreferences = cookieStore.get(APP_PREFERENCES_COOKIE_NAME)?.value;
  return parseAppPreferences(rawPreferences);
}
