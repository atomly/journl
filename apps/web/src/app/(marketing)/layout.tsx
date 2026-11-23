import { ThemeProvider } from "next-themes";
import { TRPCReactProvider } from "~/trpc/react";
import "./styles.css";

type AppLayoutProps = {
  children: React.ReactNode;
};

/**
 * Marketing renders the approved light plate by default. The class theme
 * system stays intact: an explicit stored preference still resolves dark.
 */
function MarketingLayout({ children }: AppLayoutProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TRPCReactProvider>{children}</TRPCReactProvider>
    </ThemeProvider>
  );
}

export default MarketingLayout;
