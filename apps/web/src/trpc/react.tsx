"use client";

import type { AppRouter } from "@acme/api";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
	createTRPCClient,
	httpBatchStreamLink,
	loggerLink,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import SuperJSON from "superjson";

import { env } from "~/env";
import { createQueryClient } from "./query-client.js";

let clientQueryClientSingleton: QueryClient | undefined;
const getQueryClient = () => {
	if (typeof window === "undefined") {
		// Server: always make a new query client
		return createQueryClient();
	}
	if (!clientQueryClientSingleton) {
		// Browser: use singleton pattern to keep the same query client
		clientQueryClientSingleton = createQueryClient();
	}
	return clientQueryClientSingleton;
};

export const { useTRPC, TRPCProvider } = createTRPCContext<AppRouter>();

export function TRPCReactProvider(props: { children: React.ReactNode }) {
	const queryClient = getQueryClient();

	const [trpcClient] = useState(() =>
		createTRPCClient<AppRouter>({
			links: [
				loggerLink({
					enabled: (op) =>
						env.NODE_ENV === "development" ||
						(op.direction === "down" && op.result instanceof Error),
				}),
				httpBatchStreamLink({
					headers() {
						const headers = new Headers();
						headers.set("x-trpc-source", "nextjs-react");
						return headers;
					},
					transformer: SuperJSON,
					url: `${getBaseUrl()}/api/trpc`,
				}),
			],
		}),
	);

	return (
		<QueryClientProvider client={queryClient}>
			<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
				{props.children}
			</TRPCProvider>
		</QueryClientProvider>
	);
}

const getBaseUrl = () => {
	if (typeof window !== "undefined") return window.location.origin;
	if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
	// biome-ignore lint/style/noProcessEnv: <process.env is good here for the dev server>
	return `http://localhost:${process.env.PORT ?? 3000}`;
};
