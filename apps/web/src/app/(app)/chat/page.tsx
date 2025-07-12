"use client";

import {
	AssistantRuntimeProvider,
	WebSpeechSynthesisAdapter,
} from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { Thread } from "~/components/ai/thread";
import { ThreadList } from "~/components/ai/thread-list";

export default function SearchPage() {
	const runtime = useChatRuntime({
		adapters: {
			speech: new WebSpeechSynthesisAdapter(),
		},
		api: "/api/chat",
	});

	return (
		<AssistantRuntimeProvider runtime={runtime}>
			<div className="grid h-full grid-cols-[200px_1fr] gap-x-2 px-4 py-4">
				<ThreadList />
				<Thread />
			</div>
		</AssistantRuntimeProvider>
	);
}
