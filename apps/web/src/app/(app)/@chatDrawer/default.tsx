"use client";

import {
	AssistantRuntimeProvider,
	ComposerPrimitive,
	ThreadPrimitive,
	WebSpeechSynthesisAdapter,
} from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { SendHorizontalIcon } from "lucide-react";
import {
	AssistantMessage,
	ComposerAction,
	EditComposer,
	ThreadScrollToBottom,
	ThreadWelcome,
	UserMessage,
} from "~/components/ai/thread";
import { TooltipIconButton } from "~/components/ai/tooltip-icon-button";

import {
	Drawer,
	DrawerContent,
	DrawerDivider,
	DrawerTrigger,
} from "~/components/ui/drawer";

export default function ChatDrawer() {
	const runtime = useChatRuntime({
		adapters: {
			speech: new WebSpeechSynthesisAdapter(),
		},
		api: "/api/chat",
		initialMessages: [],
	});

	return (
		<Drawer>
			<DrawerTrigger asChild>
				<div className="p-2">
					<div className="flex w-full flex-row items-center justify-between rounded-lg border bg-sidebar px-2 py-4">
						<div className="w-full cursor-text text-muted-foreground text-sm">
							Ask anything...
						</div>
						<TooltipIconButton
							tooltip="Send"
							variant="default"
							className="size-8 p-2 transition-opacity ease-in"
						>
							<SendHorizontalIcon className="size-4" />
						</TooltipIconButton>
					</div>
				</div>
			</DrawerTrigger>
			<DrawerContent className="!h-full !max-h-[90dvh]">
				<div className="!h-full relative">
					<DrawerDivider className="-translate-x-1/2 absolute top-0 left-1/2 z-50" />
					<AssistantRuntimeProvider runtime={runtime}>
						<ThreadPrimitive.Root
							className="relative box-border flex h-full flex-col overflow-hidden bg-background pt-6"
							style={{
								["--thread-max-width" as string]: "42rem",
							}}
						>
							<ThreadPrimitive.Viewport className="flex h-full flex-col items-center overflow-y-scroll scroll-smooth bg-inherit px-4">
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
											className="max-h-40 flex-grow resize-none border-none bg-transparent px-2 py-4 text-md outline-none placeholder:text-muted-foreground focus:ring-0 disabled:cursor-not-allowed"
										/>
										<ComposerAction />
									</ComposerPrimitive.Root>
								</div>
							</ThreadPrimitive.Viewport>
						</ThreadPrimitive.Root>
					</AssistantRuntimeProvider>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
