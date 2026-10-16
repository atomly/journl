import { api } from "~/trpc/server";
import { AppSidebarUserDropdown } from "./app-sidebar-user-dropdown";

export async function AppSidebarUser() {
  const subscription = await api.subscription.getSubscription();
  return <AppSidebarUserDropdown hasSubscription={Boolean(subscription)} />;
}
