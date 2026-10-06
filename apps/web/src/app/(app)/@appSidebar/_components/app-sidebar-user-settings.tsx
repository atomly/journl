"use client";

import { Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { DropdownMenuItem } from "~/components/ui/dropdown-menu";

export function AppSidebarUserSettings() {
  const router = useRouter();

  const handleClick = () => {
    // Add a small delay to allow the dropdown to close before navigation
    requestAnimationFrame(() => {
      router.push("/account/settings");
    });
  };

  return (
    <DropdownMenuItem className="w-full cursor-pointer" onClick={handleClick}>
      <Settings />
      Settings
    </DropdownMenuItem>
  );
}
