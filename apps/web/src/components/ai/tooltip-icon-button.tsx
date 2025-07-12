"use client";

import type { ComponentProps } from "react";
import { Button } from "~/components/ai/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ai/tooltip";
import { cn } from "~/components/utils";

export type TooltipIconButtonProps = ComponentProps<typeof Button> & {
	tooltip: string;
	side?: "top" | "bottom" | "left" | "right";
};

export function TooltipIconButton({
	children,
	tooltip,
	side = "bottom",
	className,
	ref,
	...rest
}: TooltipIconButtonProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					{...rest}
					className={cn("aui-button-icon", className)}
					ref={ref}
				>
					{children}
					<span className="aui-sr-only">{tooltip}</span>
				</Button>
			</TooltipTrigger>
			<TooltipContent side={side}>{tooltip}</TooltipContent>
		</Tooltip>
	);
}
