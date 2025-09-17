"use client";

import { Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthModal } from "~/components/auth/auth-modal-provider";
import { DropdownMenuItem } from "~/components/ui/dropdown-menu";

export function AppSidebarUserSettings() {
  const router = useRouter();
  const pathname = usePathname();
  const { setCancelUrl } = useAuthModal();

  const handleClick = () => {
    setCancelUrl(pathname);

    // Add a small delay to allow the dropdown to close before navigation
    requestAnimationFrame(() => {
      router.push("/auth/settings");
    });
  };

  return (
    <DropdownMenuItem className="w-full cursor-pointer" onClick={handleClick}>
      <Settings />
      Settings
    </DropdownMenuItem>
  );
}
