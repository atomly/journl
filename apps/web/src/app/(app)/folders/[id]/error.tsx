"use client";
import { buttonVariants } from "@acme/ui/button";
import { cn } from "cn";

import Link from "next/link";
import { useEffect } from "react";

export default function FolderDetailsError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col items-center justify-center gap-y-4 px-4 py-8 text-center md:px-8">
      <h2 className="font-bold text-2xl">Sorry, something went wrong.</h2>
      <Link
        href="/journal"
        className={cn(buttonVariants({ size: "default", variant: "default" }))}
      >
        Go back to your Journal
      </Link>
    </div>
  );
}
