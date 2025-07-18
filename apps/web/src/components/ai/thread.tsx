import {
	ActionBarPrimitive,
	BranchPickerPrimitive,
	ComposerPrimitive,
	ErrorPrimitive,
	MessagePrimitive,
	ThreadPrimitive,
} from "@assistant-ui/react";
import {
	ArrowDownIcon,
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CopyIcon,
	PencilIcon,
	RefreshCwIcon,
	SendHorizontalIcon,
} from "lucide-react";
import { MarkdownText } from "~/components/ai/markdown-text";
import { TooltipIconButton } from "~/components/ai/tooltip-icon-button";
import { Button } from "~/components/ui/button";
import { cn } from "~/components/utils";

export function Thread() {
	return (
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
					<Composer />
				</div>
			</ThreadPrimitive.Viewport>
		</ThreadPrimitive.Root>
	);
}

function ThreadScrollToBottom() {
	return (
		<ThreadPrimitive.ScrollToBottom asChild>
			<TooltipIconButton
				tooltip="Scroll to bottom"
				variant="outline"
				className="-top-8 absolute rounded-full disabled:invisible"
			>
				<ArrowDownIcon />
			</TooltipIconButton>
		</ThreadPrimitive.ScrollToBottom>
	);
}

function ThreadWelcome() {
	return (
		<ThreadPrimitive.Empty>
			<div className="flex w-full max-w-[var(--thread-max-width)] flex-grow flex-col">
				<div className="flex w-full flex-grow flex-col items-center justify-center">
					<p className="mt-4 font-medium">How can I help you today?</p>
				</div>
				<ThreadWelcomeSuggestions />
			</div>
		</ThreadPrimitive.Empty>
	);
}

function ThreadWelcomeSuggestions() {
	return (
		<div className="mt-3 flex w-full items-stretch justify-center gap-4">
			<ThreadPrimitive.Suggestion
				className="flex max-w-sm grow basis-0 flex-col items-center justify-center rounded-lg border p-3 transition-colors ease-in hover:bg-muted/80"
				prompt="What is the weather in Tokyo?"
				method="replace"
				autoSend
			>
				<span className="line-clamp-2 text-ellipsis font-semibold text-sm">
					What is the weather in Tokyo?
				</span>
			</ThreadPrimitive.Suggestion>
			<ThreadPrimitive.Suggestion
				className="flex max-w-sm grow basis-0 flex-col items-center justify-center rounded-lg border p-3 transition-colors ease-in hover:bg-muted/80"
				prompt="What is assistant-ui?"
				method="replace"
				autoSend
			>
				<span className="line-clamp-2 text-ellipsis font-semibold text-sm">
					What is assistant-ui?
				</span>
			</ThreadPrimitive.Suggestion>
		</div>
	);
}

function Composer() {
	return (
		<ComposerPrimitive.Root className="flex w-full flex-wrap items-end rounded-lg border bg-inherit px-2.5 shadow-sm transition-colors ease-in focus-within:border-ring/20">
			<ComposerPrimitive.Input
				rows={1}
				autoFocus
				placeholder="Write a message..."
				className="max-h-40 flex-grow resize-none border-none bg-transparent px-2 py-4 text-sm outline-none placeholder:text-muted-foreground focus:ring-0 disabled:cursor-not-allowed"
			/>
			<ComposerAction />
		</ComposerPrimitive.Root>
	);
}

function ComposerAction() {
	return (
		<>
			<ThreadPrimitive.If running={false}>
				<ComposerPrimitive.Send asChild>
					<TooltipIconButton
						tooltip="Send"
						variant="default"
						className="my-2.5 size-8 p-2 transition-opacity ease-in"
					>
						<SendHorizontalIcon />
					</TooltipIconButton>
				</ComposerPrimitive.Send>
			</ThreadPrimitive.If>
			<ThreadPrimitive.If running>
				<ComposerPrimitive.Cancel asChild>
					<TooltipIconButton
						tooltip="Cancel"
						variant="default"
						className="my-2.5 size-8 p-2 transition-opacity ease-in"
					>
						<CircleStopIcon />
					</TooltipIconButton>
				</ComposerPrimitive.Cancel>
			</ThreadPrimitive.If>
		</>
	);
}

function UserMessage() {
	return (
		<MessagePrimitive.Root className="grid w-full max-w-[var(--thread-max-width)] auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 py-4 [&:where(>*)]:col-start-2">
			<UserActionBar />

			<div className="col-start-2 row-start-2 max-w-[calc(var(--thread-max-width)*0.8)] break-words rounded-3xl bg-muted px-5 py-2.5 text-foreground">
				<MessagePrimitive.Content />
			</div>

			<BranchPicker className="-mr-1 col-span-full col-start-1 row-start-3 justify-end" />
		</MessagePrimitive.Root>
	);
}

function UserActionBar() {
	return (
		<ActionBarPrimitive.Root
			hideWhenRunning
			autohide="not-last"
			className="col-start-1 row-start-2 mt-2.5 mr-3 flex flex-col items-end"
		>
			<ActionBarPrimitive.Edit asChild>
				<TooltipIconButton tooltip="Edit">
					<PencilIcon />
				</TooltipIconButton>
			</ActionBarPrimitive.Edit>
		</ActionBarPrimitive.Root>
	);
}

function EditComposer() {
	return (
		<ComposerPrimitive.Root className="my-4 flex w-full max-w-[var(--thread-max-width)] flex-col gap-2 rounded-xl bg-muted">
			<ComposerPrimitive.Input className="flex h-8 w-full resize-none bg-transparent p-4 pb-0 text-foreground outline-none" />

			<div className="mx-3 mb-3 flex items-center justify-center gap-2 self-end">
				<ComposerPrimitive.Cancel asChild>
					<Button variant="ghost">Cancel</Button>
				</ComposerPrimitive.Cancel>
				<ComposerPrimitive.Send asChild>
					<Button>Send</Button>
				</ComposerPrimitive.Send>
			</div>
		</ComposerPrimitive.Root>
	);
}

function AssistantMessage() {
	return (
		<MessagePrimitive.Root className="relative grid w-full max-w-[var(--thread-max-width)] grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr] py-4">
			<div className="col-span-2 col-start-2 row-start-1 my-1.5 max-w-[calc(var(--thread-max-width)*0.8)] break-words text-foreground leading-7">
				<MessagePrimitive.Content components={{ Text: MarkdownText }} />
				<MessageError />
			</div>

			<AssistantActionBar />

			<BranchPicker className="-ml-2 col-start-2 row-start-2 mr-2" />
		</MessagePrimitive.Root>
	);
}

function MessageError() {
	return (
		<MessagePrimitive.Error>
			<ErrorPrimitive.Root className="mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-200">
				<ErrorPrimitive.Message className="line-clamp-2" />
			</ErrorPrimitive.Root>
		</MessagePrimitive.Error>
	);
}

function AssistantActionBar() {
	return (
		<ActionBarPrimitive.Root
			hideWhenRunning
			autohide="not-last"
			autohideFloat="single-branch"
			className="-ml-1 col-start-3 row-start-2 flex gap-1 text-muted-foreground data-[floating]:absolute data-[floating]:rounded-md data-[floating]:border data-[floating]:bg-background data-[floating]:p-1 data-[floating]:shadow-sm"
		>
			<ActionBarPrimitive.Copy asChild>
				<TooltipIconButton tooltip="Copy">
					<MessagePrimitive.If copied>
						<CheckIcon />
					</MessagePrimitive.If>
					<MessagePrimitive.If copied={false}>
						<CopyIcon />
					</MessagePrimitive.If>
				</TooltipIconButton>
			</ActionBarPrimitive.Copy>
			<ActionBarPrimitive.Reload asChild>
				<TooltipIconButton tooltip="Refresh">
					<RefreshCwIcon />
				</TooltipIconButton>
			</ActionBarPrimitive.Reload>
		</ActionBarPrimitive.Root>
	);
}

function BranchPicker({
	className,
	...rest
}: BranchPickerPrimitive.Root.Props) {
	return (
		<BranchPickerPrimitive.Root
			hideWhenSingleBranch
			className={cn(
				"inline-flex items-center text-muted-foreground text-xs",
				className,
			)}
			{...rest}
		>
			<BranchPickerPrimitive.Previous asChild>
				<TooltipIconButton tooltip="Previous">
					<ChevronLeftIcon />
				</TooltipIconButton>
			</BranchPickerPrimitive.Previous>
			<span className="font-medium">
				<BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
			</span>
			<BranchPickerPrimitive.Next asChild>
				<TooltipIconButton tooltip="Next">
					<ChevronRightIcon />
				</TooltipIconButton>
			</BranchPickerPrimitive.Next>
		</BranchPickerPrimitive.Root>
	);
}

function CircleStopIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 16 16"
			fill="currentColor"
			width="16"
			height="16"
			aria-hidden="true"
		>
			<rect width="10" height="10" x="3" y="3" rx="2" />
		</svg>
	);
}
