"use client";

import { useCallback, useEffect, useRef } from "react";
import { cn } from "~/components/utils/cn";
import { Textarea } from "./textarea";

export function FullHeightTextarea({
	className,
	ref,
	onChange,
	...props
}: React.ComponentProps<"textarea">) {
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	const calculateHeight = useCallback(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		// Store the current scroll position
		const scrollPos = textarea.scrollTop;

		// Reset height to auto to get the correct scrollHeight
		textarea.style.height = "auto";

		// Get the scroll height and add a small padding
		const scrollHeight = textarea.scrollHeight;

		// Set the new height
		textarea.style.height = `${scrollHeight}px`;

		// Restore the scroll position
		textarea.scrollTop = scrollPos;
	}, []);

	useEffect(() => {
		calculateHeight();
		// Add resize observer to handle window/container resizing
		const resizeObserver = new ResizeObserver(calculateHeight);
		if (textareaRef.current) {
			resizeObserver.observe(textareaRef.current);
		}

		return () => resizeObserver.disconnect();
	}, [calculateHeight]);

	function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
		calculateHeight();
		onChange?.(e);
	}

	return (
		<Textarea
			className={cn(
				"flex min-h-[60px] w-full transition-all duration-100",
				className,
				"overflow-y-hidden",
			)}
			ref={(element) => {
				// Handle both forwardRef and internal ref
				textareaRef.current = element;
				if (typeof ref === "function") {
					ref(element);
				} else if (ref) {
					ref.current = element;
				}
			}}
			onChange={handleChange}
			{...props}
		/>
	);
}
