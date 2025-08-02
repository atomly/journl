"use client";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "~/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";
import { useIsMobile } from "~/hooks/use-mobile";
import { useTRPC } from "~/trpc/react";

const MIN_QUERY_LENGTH = 2;
const DEFAULT_THRESHOLD = 0.25;
const DEFAULT_LIMIT = 10;
type HeaderSearchButtonProps = React.ComponentProps<typeof Dialog> & {
	children: React.ReactNode;
	limit?: number;
	threshold?: number;
};

export function HeaderSearchButton({
	children,
	limit = DEFAULT_LIMIT,
	threshold = DEFAULT_THRESHOLD,
	...rest
}: HeaderSearchButtonProps) {
	const isMobile = useIsMobile();
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState("");

	// Keyboard shortcut handlers
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if ((event.metaKey || event.ctrlKey) && event.key === "k") {
				event.preventDefault();
				setIsOpen((prev) => !prev);
			}
			if (event.key === "Escape" && isOpen) {
				event.preventDefault();
				setIsOpen(false);
			}
		}

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen]);

	const trpc = useTRPC();
	const { data: notes, isLoading } = useQuery({
		...trpc.notes.getRelevantNotes.queryOptions({
			limit,
			query,
			threshold,
		}),
		enabled: query.length > MIN_QUERY_LENGTH,
	});

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen} {...rest}>
			<div className="@container flex w-full flex-1 justify-end">
				<DialogTrigger asChild>{children}</DialogTrigger>
			</div>
			<DialogContent
				className="gap-0 rounded-2xl border-4 border-muted bg-sidebar p-0"
				data-state="open"
				showCloseButton={false}
			>
				<Command className="bg-transparent p-0" shouldFilter={false}>
					<DialogHeader className="px-2 pt-2">
						<DialogTitle className="sr-only">
							Search pages and journal entries
						</DialogTitle>
						<div className="flex w-full items-center gap-x-2 rounded-lg border-2 bg-muted px-2 [&>div]:w-full">
							<CommandInput
								className="flex h-10 w-full rounded-md border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
								placeholder="Search notes..."
								autoComplete="off"
								autoCorrect="off"
								spellCheck={false}
								autoFocus
								value={query}
								onValueChange={(value) => setQuery(value)}
							/>
						</div>
					</DialogHeader>
					<ScrollArea>
						<CommandList className="p-4">
							<CommandEmpty className="py-2 text-center">
								{isLoading ? (
									<div className="flex flex-col gap-2">
										<Skeleton className="h-10 w-full" />
										<Skeleton className="h-10 w-full" />
										<Skeleton className="h-10 w-full" />
									</div>
								) : !notes ? (
									<span className="text-muted-foreground text-sm">
										Write something to search
									</span>
								) : (
									<span className="text-muted-foreground text-sm">
										No results found.
									</span>
								)}
							</CommandEmpty>
							<CommandGroup
								className="p-0"
								heading={notes?.length ? "Results" : undefined}
							>
								{notes?.map((note) => (
									<Link
										key={note.id}
										href={
											note.type === "journal"
												? `/journal/${note.id}`
												: `/pages/${note.id}`
										}
									>
										<CommandItem
											className="my-1 grid cursor-pointer grid-cols-[1fr_auto] gap-2"
											onSelect={() => setIsOpen(false)}
										>
											<div className="grid gap-1">
												{note.type === "page" ? (
													<>
														<div className="font-medium text-sm">
															<CommandText text={note.header} query={query} />
														</div>
														<div className="line-clamp-2 text-muted-foreground text-sm">
															<CommandText
																text={note.content}
																query={query}
																maxLength={120}
															/>
														</div>
														<div className="text-muted-foreground text-xs">
															Last updated{" "}
															{new Date(note.date).toLocaleDateString()}
														</div>
													</>
												) : (
													<>
														<div className="text-muted-foreground text-sm">
															{new Date(note.date).toLocaleDateString()}
														</div>
														<div className="line-clamp-2 text-muted-foreground text-sm">
															<CommandText
																text={note.content}
																query={query}
																maxLength={120}
															/>
														</div>
													</>
												)}
											</div>
											<Badge variant="secondary" className="self-start text-xs">
												{note.type === "journal" ? "Journal" : "Page"}
											</Badge>
										</CommandItem>
									</Link>
								))}
							</CommandGroup>
						</CommandList>
					</ScrollArea>
				</Command>
				<DialogFooter className="flex flex-row items-center bg-muted p-1">
					{isMobile ? (
						<Button
							className="ms-auto bg-background py-1 text-background-foreground text-sm hover:bg-background/80 hover:text-background-foreground"
							onClick={() => setIsOpen(false)}
						>
							Close <X className="size-3" />
						</Button>
					) : (
						<>
							<div className="flex items-center justify-center gap-x-1.5 py-1">
								<kbd className="flex h-5 select-none items-center rounded border bg-background px-1.5 font-medium font-mono text-lg text-muted-foreground">
									⏎
								</kbd>
								<span className="text-muted-foreground text-sm">
									Go to your note
								</span>
							</div>
							<div className="flex-1" />
							<div className="flex items-center justify-center gap-x-1.5 py-1">
								<span className="text-muted-foreground text-sm">
									To navigate
								</span>
								<div className="flex items-center gap-x-0.5">
									<kbd className="flex h-5 select-none items-center rounded border bg-background px-1.5 font-medium font-mono text-lg text-muted-foreground">
										↑
									</kbd>
									<kbd className="flex h-5 select-none items-center rounded border bg-background px-1.5 font-medium font-mono text-lg text-muted-foreground">
										↓
									</kbd>
								</div>
							</div>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function CommandText({
	text,
	query,
	maxLength,
}: {
	text: string;
	query: string;
	maxLength?: number;
}) {
	// Truncate text if maxLength is provided
	const displayText =
		maxLength && text.length > maxLength
			? `${text.slice(0, maxLength)}...`
			: text;

	if (!query || query.length < MIN_QUERY_LENGTH) {
		return <>{displayText}</>;
	}

	const queryWords = query
		.toLowerCase()
		.split(/\s+/)
		.filter((word) => word.length > 0);

	if (queryWords.length === 0) {
		return <>{text}</>;
	}

	const regex = new RegExp(
		`(${queryWords
			.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
			.join("|")})`,
		"gi",
	);

	const parts = displayText.split(regex);

	return (
		<>
			{parts.map((part, index) => {
				const isMatch = queryWords.some(
					(word) => part.toLowerCase() === word.toLowerCase(),
				);
				return isMatch ? (
					<mark
						// biome-ignore lint/suspicious/noArrayIndexKey: <Using the `index` is fine here.>
						key={`${part}-${index}`}
						className="rounded-sm bg-accent font-semibold text-accent-foreground"
					>
						{part}
					</mark>
				) : (
					part
				);
			})}
		</>
	);
}
