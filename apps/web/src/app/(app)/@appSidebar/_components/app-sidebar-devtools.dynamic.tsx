"use client";

import dynamic from "next/dynamic";

export const DynamicAppSidebarDevtools = dynamic(
  () => import("./app-sidebar-devtools").then((mod) => mod.AppSidebarDevtools),
  { ssr: false },
);
