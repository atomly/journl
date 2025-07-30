"use client";

import Link from "next/link";
import { BetterAuthProvider } from "../../components/auth/better-auth-provider";

export function RootProviders({ children }: { children: React.ReactNode }) {
	return <BetterAuthProvider Link={Link}>{children}</BetterAuthProvider>;
}
