import { Toaster } from "~/components/ui/toast";
import "./globals.css";
import { AuthProviders } from "./_components/auth-providers";
import { AuthHeader } from "./auth/[pathname]/_components/auth-header";

type AppLayoutProps = {
  children: React.ReactNode;
};

function AuthLayout({ children }: AppLayoutProps) {
  return (
    <AuthProviders>
      <div className="flex min-h-svh flex-col">
        <AuthHeader />
        <main className="container mx-auto flex flex-1 grow flex-col items-center justify-center gap-4 self-center p-4 md:p-6">
          {children}
        </main>
      </div>
      <Toaster />
    </AuthProviders>
  );
}

export default AuthLayout;
