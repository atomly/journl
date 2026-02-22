"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";

function useNavbarShadow() {
  const [isAtTop, setIsAtTop] = useState(true);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function handleScroll() {
      if (navRef.current) {
        const rect = navRef.current.getBoundingClientRect();
        setIsAtTop(rect.top <= 0);
      }
    }

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Check initial state

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return { isAtTop, navRef };
}

export function StickyJournlHeader() {
  const { isAtTop, navRef } = useNavbarShadow();

  return (
    <nav
      ref={navRef}
      className={cn(
        "sticky top-0 z-50 mb-4 flex w-full flex-row items-center justify-center gap-x-2 bg-background px-2 py-4 transition-all duration-300 ease-in-out",
        isAtTop
          ? "border-border border-b shadow-sm"
          : "border-none shadow-none",
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        className="rounded-lg bg-background text-foreground"
      >
        Sign In
      </Button>
      <Button
        size="sm"
        className="rounded-lg bg-primary text-primary-foreground"
      >
        Get Started
      </Button>
    </nav>
  );
}
