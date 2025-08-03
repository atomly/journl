"use client";

import { MantineProvider } from "@mantine/core";
import { ThreadRuntime } from "~/components/ai/thread-runtime";

export function AppProviders({ children }: { children: React.ReactNode }) {
	return (
		<MantineProvider>
			<ThreadRuntime api="/api/chat" initialMessages={[]}>
				{children}
			</ThreadRuntime>
		</MantineProvider>
	);
}
