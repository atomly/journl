import { ThemeProvider } from "next-themes";
import { TRPCReactProvider } from "~/trpc/react";

type AppLayoutProps = {
  children: React.ReactNode;
};

function MarketingLayout({ children }: AppLayoutProps) {
  return (
    <ThemeProvider attribute="class" forcedTheme="dark" enableSystem>
      <TRPCReactProvider>{children}</TRPCReactProvider>
    </ThemeProvider>
  );
}

export default MarketingLayout;
