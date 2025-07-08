import { useCallback, useEffect, useRef } from "react";
import { cn } from "~/lib/cn";

export function AutosizeTextarea({
	className,
	ref,
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

	const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		calculateHeight();
		if (props.onChange) {
			props.onChange(e);
		}
	};

	return (
		<textarea
			className={cn(
				"flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
				"text-xs transition-all duration-100 md:text-sm",
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
			onChange={handleInput}
			{...props}
		/>
	);
}
