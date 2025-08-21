"use client";

import dynamic from "next/dynamic";

export const DynamicPageEditor = dynamic(
	() => import("./page-editor").then((mod) => mod.PageEditor),
	{
		ssr: false,
	},
);
