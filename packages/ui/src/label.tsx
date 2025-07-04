import { cn } from "@acme/ui";
import { Label as LabelPrimitive } from "radix-ui";
import type * as React from "react";

export function Label({
	className,
	...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
	return (
		<LabelPrimitive.Root
			className={cn(
				"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
				className,
			)}
			{...props}
		/>
	);
}
