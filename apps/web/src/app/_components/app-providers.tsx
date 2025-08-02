"use client";

import { ThreadRuntime } from "~/components/ai/thread-runtime";

export function AppProviders({ children }: { children: React.ReactNode }) {
	return (
		<ThreadRuntime api="/api/chat" initialMessages={[]}>
			{children}
		</ThreadRuntime>
	);
}
