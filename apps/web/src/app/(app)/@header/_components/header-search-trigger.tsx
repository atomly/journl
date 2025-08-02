"use client";
import { Search } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/components/utils/cn";
import { useIsMobile } from "~/hooks/use-mobile";

export function HeaderSearchTrigger({
	className,
	...props
}: React.ComponentProps<"button">) {
	const isMobile = useIsMobile();
	return (
		<Button
			variant="outline"
			className={cn(
				"relative h-8 @[180px]:w-full w-8 @[180px]:max-w-48 @[180px]:justify-start justify-center overflow-hidden bg-muted/50 font-normal text-muted-foreground text-sm shadow-none",
				className,
			)}
			{...props}
		>
			<Search className="@[180px]:hidden size-4 shrink-0" />
			<span className="@[180px]:inline hidden">Search notes...</span>
			{!isMobile && (
				<div className="pointer-events-none absolute top-1.5 right-1.5 @[180px]:flex hidden items-center gap-0.5">
					<kbd className="flex h-5 select-none items-center rounded border bg-background px-1.5 font-medium font-mono text-lg text-muted-foreground">
						⌘
					</kbd>
					<kbd className="flex h-5 select-none items-center rounded border bg-background px-1.5 font-medium font-mono text-muted-foreground text-xs">
						K
					</kbd>
				</div>
			)}
		</Button>
	);
}
