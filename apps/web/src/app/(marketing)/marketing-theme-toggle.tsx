"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { flushSync } from "react-dom";

export function MarketingThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <button
      aria-label="Toggle color theme"
      className="btn marketing-theme-toggle"
      type="button"
      onClick={(event) => {
        const root = document.documentElement;
        if (root.hasAttribute("data-marketing-theme-reveal")) return;

        const next = root.classList.contains("dark") ? "light" : "dark";
        if (
          !document.startViewTransition ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          setTheme(next);
          return;
        }

        const button = event.currentTarget.getBoundingClientRect();
        const x = button.left + button.width / 2;
        const y = button.top + button.height / 2;
        const radius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y),
        );
        root.style.setProperty("--theme-reveal-origin", `${x}px ${y}px`);
        root.style.setProperty("--theme-reveal-radius", `${radius}px`);
        root.setAttribute("data-marketing-theme-reveal", "");
        const transition = document.startViewTransition(() => {
          flushSync(() => setTheme(next));
        });
        const cleanup = () => {
          root.removeAttribute("data-marketing-theme-reveal");
          root.style.removeProperty("--theme-reveal-origin");
          root.style.removeProperty("--theme-reveal-radius");
        };
        void transition.finished.then(cleanup, cleanup);
      }}
    >
      <Moon aria-hidden="true" className="size-4 dark:hidden" />
      <Sun aria-hidden="true" className="hidden size-4 dark:block" />
    </button>
  );
}
