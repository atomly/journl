"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "../../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu";

export { ThemeProvider } from "next-themes";

type Theme = "light" | "dark" | "system";

export function HeaderThemeToggle() {
  const { setTheme } = useTheme();

  function startThemeViewTransition(theme: Theme) {
    if (!document.startViewTransition) return setTheme(theme);
    return document.startViewTransition(() => setTheme(theme));
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button className="size-8" variant="outline" size="icon" type="button">
          <Sun className="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => startThemeViewTransition("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => startThemeViewTransition("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => startThemeViewTransition("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
