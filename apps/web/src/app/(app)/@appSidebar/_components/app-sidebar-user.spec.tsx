// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { SidebarProvider } from "~/components/ui/sidebar";
import { AppSidebarUser } from "./app-sidebar-user";

vi.mock("~/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("~/auth/server", () => ({
  getUser: async () => ({
    email: "owner@example.invalid",
    id: "owner",
    image: null,
    name: "Browser owner",
  }),
}));
vi.mock("~/trpc/server", () => ({
  api: { subscription: { getSubscription: async () => null } },
}));
vi.mock("./app-sidebar-user-settings", () => ({
  AppSidebarUserSettings: () => null,
}));
vi.mock("./app-sidebar-user-sign-out", () => ({
  AppSidebarUserSignOut: () => null,
}));

test("the server-provided owner menu composes its trigger through Base UI's render API", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    const ownerMenu = await AppSidebarUser();
    await act(() =>
      root.render(<SidebarProvider>{ownerMenu}</SidebarProvider>),
    );
    const trigger = container.querySelector<HTMLButtonElement>(
      "[data-slot=dropdown-menu-trigger]",
    );
    expect(trigger?.tagName).toBe("BUTTON");
    expect(trigger?.textContent).toContain("Browser owner");
    expect(trigger?.getAttribute("aria-haspopup")).toBe("menu");
    await act(() => trigger?.click());
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
  } finally {
    await act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
