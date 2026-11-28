import { ThemeProvider } from "next-themes";
import { TRPCReactProvider } from "~/trpc/react";
import "./styles.css";

type AppLayoutProps = {
  children: React.ReactNode;
};

function MarketingLayout({ children }: AppLayoutProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TRPCReactProvider>{children}</TRPCReactProvider>
    </ThemeProvider>
  );
}

export default MarketingLayout;
