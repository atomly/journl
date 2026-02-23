"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useDrawer } from "~/components/ui/drawer";

export function CloseDrawerOnNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousUrlRef = useRef<string | null>(null);
  const { closeDrawer } = useDrawer();

  useEffect(() => {
    const currentUrl = `${pathname}?${searchParams.toString()}`;

    if (previousUrlRef.current && previousUrlRef.current !== currentUrl) {
      closeDrawer();
    }

    previousUrlRef.current = currentUrl;
  }, [closeDrawer, pathname, searchParams]);

  return null;
}
