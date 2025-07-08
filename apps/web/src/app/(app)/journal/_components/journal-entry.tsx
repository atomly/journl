"use client";

import type { JournalEntry as TJournalEntry } from "@acme/db/schema";
import type React from "react";
import { cn } from "~/lib/cn";
import { formatDate } from "~/lib/format-date";
import { JournalTextArea } from "./journal-text-area";

type JournalEntryOptions = Omit<React.ComponentProps<"div">, "children"> & {
	entry: Partial<TJournalEntry>;
};

export function JournalEntry({
	entry,
	className,
	...rest
}: JournalEntryOptions) {
	const date = new Date(`${entry.date}T00:00:00`);
	const now = new Date();
	const isToday = date.toDateString() === now.toDateString();

	return (
		<div className={cn("border-border/10 border-b", className)} {...rest}>
			<div className="mb-3">
				<h2 className="font-semibold text-2xl text-muted-foreground">
					{isToday ? "Today" : formatDate(date)}
				</h2>
			</div>
			<div className="flex items-start gap-2">
				{/* Bullet point next to the text area input. */}
				<div className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground/40" />
				<div className="min-w-0 flex-1">
					<JournalTextArea
						name={`journal-entry-${entry.date}`}
						entryDate={date}
						className="w-full text-sm leading-relaxed"
						initialContent={"content" in entry ? entry.content : undefined}
						placeholder={
							isToday ? "Start writing your journal entry..." : undefined
						}
					/>
				</div>
			</div>
		</div>
	);
}
