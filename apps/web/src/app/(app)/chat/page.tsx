"use client";

import {
	AssistantRuntimeProvider,
	ComposerPrimitive,
	ThreadPrimitive,
	WebSpeechSynthesisAdapter,
} from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import {
	AssistantMessage,
	ComposerAction,
	EditComposer,
	ThreadScrollToBottom,
	ThreadWelcome,
	UserMessage,
} from "~/components/ai/thread";
import { ThreadList } from "~/components/ai/thread-list";

export default function ChatPage() {
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

				<ThreadPrimitive.Root
					className="box-border flex h-full flex-col overflow-hidden bg-background"
					style={{
						["--thread-max-width" as string]: "42rem",
					}}
				>
					<ThreadPrimitive.Viewport className="flex h-full flex-col items-center overflow-y-scroll scroll-smooth bg-inherit px-4 pt-8">
						<ThreadWelcome />

						<ThreadPrimitive.Messages
							components={{
								AssistantMessage: AssistantMessage,
								EditComposer: EditComposer,
								UserMessage: UserMessage,
							}}
						/>

						<ThreadPrimitive.If empty={false}>
							<div className="min-h-8 flex-grow" />
						</ThreadPrimitive.If>

						<div className="sticky bottom-0 mt-3 flex w-full max-w-[var(--thread-max-width)] flex-col items-center justify-end rounded-t-lg bg-inherit pb-4">
							<ThreadScrollToBottom />
							<ComposerPrimitive.Root className="flex w-full flex-wrap items-center rounded-lg border bg-inherit px-2.5 shadow-sm transition-colors ease-in focus-within:border-ring/20">
								<ComposerPrimitive.Input
									rows={1}
									placeholder="Ask anything..."
									className="max-h-40 flex-grow resize-none border-none bg-transparent px-2 py-4 text-sm outline-none placeholder:text-muted-foreground focus:ring-0 disabled:cursor-not-allowed"
									maximum-scale={1}
								/>
								<ComposerAction />
							</ComposerPrimitive.Root>
						</div>
					</ThreadPrimitive.Viewport>
				</ThreadPrimitive.Root>
			</div>
		</AssistantRuntimeProvider>
	);
}
