import type { ReactNode } from "react";

/** Fixed light theme for a client-only harness; app theme switching is a separate parity check. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return children;
}
export const useTheme = () => ({ systemTheme: "light", theme: "light" });
