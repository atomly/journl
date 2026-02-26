import { Toaster } from "~/components/ui/toast";
import "./styles.css";
import { DashboardHeader } from "./_components/dashboard-header";
import { DashboardProviders } from "./_components/dashboard-providers";

type AppLayoutProps = {
  children: React.ReactNode;
};

function UserLayout({ children }: AppLayoutProps) {
  return (
    <DashboardProviders>
      <div className="flex min-h-svh flex-col">
        <DashboardHeader className="container mx-auto sm:mt-4" />
        <main className="container mx-auto flex flex-1 grow flex-col items-center justify-center gap-4 self-center p-4 md:p-6">
          {children}
        </main>
      </div>
      <Toaster />
    </DashboardProviders>
  );
}

export default UserLayout;
