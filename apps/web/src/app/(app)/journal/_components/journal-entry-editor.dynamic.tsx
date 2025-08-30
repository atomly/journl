"use client";

import dynamic from "next/dynamic";

export const DynamicJournalEntryEditor = dynamic(
  () => import("./journal-entry-editor").then((mod) => mod.JournalEntryEditor),
  {
    ssr: false,
  },
);
