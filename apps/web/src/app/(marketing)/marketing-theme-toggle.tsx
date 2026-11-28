"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { revealTheme } from "~/components/theme/reveal-theme";

export function MarketingThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <button
      aria-label="Toggle color theme"
      className="btn marketing-theme-toggle"
      type="button"
      onClick={(event) => {
        const next = document.documentElement.classList.contains("dark")
          ? "light"
          : "dark";
        revealTheme(() => setTheme(next), event.currentTarget);
      }}
    >
      <Moon aria-hidden="true" className="size-4 dark:hidden" />
      <Sun aria-hidden="true" className="hidden size-4 dark:block" />
    </button>
  );
}
