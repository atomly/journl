"use client";

import dynamic from "next/dynamic";

export const DynamicNotFoundEditor = dynamic(
  () => import("./not-found-editor").then((mod) => mod.NotFoundEditor),
  {
    ssr: false,
  },
);
