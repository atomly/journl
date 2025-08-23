"use client";

import Link from "next/link";
import { Button } from "~/components/ui/button";
import "./styles/blocknote.css";
import { Suspense } from "react";
import { DynamicNotFoundEditor } from "./_components/not-found-editor.dynamic";

export default function NotFound() {
	return (
		<div className="flex min-h-svh w-full flex-col items-center justify-center gap-y-2 bg-amber-50 p-4">
			<Suspense>
				<DynamicNotFoundEditor />
				<Link href="/">
					<Button>Go back to the home page</Button>
				</Link>
				<div className="flex items-center gap-x-1">
					<span className="text-muted-foreground text-sm">No account?</span>
					<Button className="p-0 text-blue-600" variant="link" asChild>
						<a href="/auth/sign-up">Create one</a>
					</Button>{" "}
				</div>
			</Suspense>
		</div>
	);
}
