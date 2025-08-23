"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "~/components/ui/button";

export default function JournalEntryError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col items-center justify-center gap-y-4 px-4 py-8 md:px-8">
      <h2 className="font-bold text-2xl">Sorry, something went wrong.</h2>
      <Button asChild>
        <Link href="/journal">Go back to your Journal</Link>
      </Button>
    </div>
  );
}
