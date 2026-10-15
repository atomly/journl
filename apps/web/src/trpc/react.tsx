"use client";

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
import type { ApiRouter } from "~/trpc";
import { createQueryClient } from "./query-client";

let clientQueryClientSingleton:
  | { owner: string; client: QueryClient }
  | undefined;
const getQueryClient = (owner?: string) => {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return createQueryClient();
  }
  if (
    !clientQueryClientSingleton ||
    clientQueryClientSingleton.owner !== owner
  ) {
    // Keep one cache through navigation, replacing it when the authenticated owner changes.
    clientQueryClientSingleton = { client: createQueryClient(), owner };
  }
  return clientQueryClientSingleton.client;
};

export const { useTRPC, TRPCProvider } = createTRPCContext<ApiRouter>();

export function TRPCReactProvider(props: {
  children: React.ReactNode;
  owner?: string;
}) {
  const queryClient = getQueryClient(props.owner);

  const [trpcClient] = useState(() =>
    createTRPCClient<ApiRouter>({
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
