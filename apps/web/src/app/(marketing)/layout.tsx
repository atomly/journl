import { withoutAuth } from "~/auth/utils";
import { TRPCReactProvider } from "~/trpc/react";

type AppLayoutProps = {
	children: React.ReactNode;
};

function AppLayout({ children }: AppLayoutProps) {
	return <TRPCReactProvider>{children}</TRPCReactProvider>;
}

export default withoutAuth(AppLayout);
