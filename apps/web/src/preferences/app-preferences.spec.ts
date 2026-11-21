import { describe, expect, test } from "vitest";
import { normalizeAppPreferences } from "./app-preferences";

describe("workspace panel preferences", () => {
  test("normal resize bounds and legacy expanded width coexist without coupling open states", () => {
    const preferences = normalizeAppPreferences({
      appSidebarOpen: false,
      appSidebarWidthRem: 19,
      chatSidebarOpen: true,
      chatSidebarWidthRem: 44,
    });
    expect(preferences).toMatchObject({
      appSidebarOpen: false,
      appSidebarWidthRem: 19,
      chatSidebarOpen: true,
      chatSidebarWidthRem: 44,
    });
    expect(
      normalizeAppPreferences({ ...preferences, chatSidebarOpen: false }),
    ).toMatchObject({
      appSidebarWidthRem: 19,
      chatSidebarOpen: false,
      chatSidebarWidthRem: 44,
    });
    expect(
      normalizeAppPreferences({
        appSidebarWidthRem: 0,
        chatSidebarWidthRem: 0,
      }),
    ).toMatchObject({ appSidebarWidthRem: 12.5, chatSidebarWidthRem: 22.5 });
    expect(
      normalizeAppPreferences({
        appSidebarWidthRem: 100,
        chatSidebarWidthRem: 100,
      }),
    ).toMatchObject({ appSidebarWidthRem: 20, chatSidebarWidthRem: 44 });
  });
});
