import type { ComponentProps } from "react";
import { cn } from "../utils/cn";
import { serverRedirect } from "./server-redirect";

/**
 * This is a custom Link component that prevents intercepting routes from being mounted.
 * IMPORTANT: Do not use this unless you know what you are doing.
 * @privateRemarks Until Next.js adds support to conditionally intercept routes, this will be necessary.
 * @see {@link https://github.com/vercel/next.js/discussions/49146 | Conditionally intercept routes #49146}
 */
export function HardLink({
	href,
	className,
	...rest
}: ComponentProps<"button"> & { href: string }) {
	return (
		<form className="contents" action={() => serverRedirect(href)}>
			<button
				className={cn("!cursor-pointer", className)}
				{...rest}
				type="submit"
			/>
		</form>
	);
}
