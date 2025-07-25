"use client";

import "@assistant-ui/react-markdown/styles/dot.css";

import {
	type CodeHeaderProps,
	MarkdownTextPrimitive,
	unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
	useIsMarkdownCodeBlock,
} from "@assistant-ui/react-markdown";
import { CheckIcon, CopyIcon } from "lucide-react";
import { memo, useState } from "react";
import remarkGfm from "remark-gfm";

import { TooltipIconButton } from "~/components/ai/tooltip-icon-button";
import { cn } from "~/components/utils";

function MarkdownTextImpl() {
	return (
		<MarkdownTextPrimitive
			remarkPlugins={[remarkGfm]}
			className="aui-md"
			components={defaultComponents}
		/>
	);
}

export const MarkdownText = memo(MarkdownTextImpl);

function CodeHeader({ language, code }: CodeHeaderProps) {
	const { isCopied, copyToClipboard } = useCopyToClipboard();
	const onCopy = () => {
		if (!code || isCopied) return;
		copyToClipboard(code);
	};

	return (
		<div className="mt-4 flex items-center justify-between gap-4 rounded-t-lg bg-zinc-900 px-4 py-2 font-semibold text-sm text-white">
			<span className="lowercase [&>span]:text-xs">{language}</span>
			<TooltipIconButton tooltip="Copy" onClick={onCopy}>
				{!isCopied && <CopyIcon />}
				{isCopied && <CheckIcon />}
			</TooltipIconButton>
		</div>
	);
}

function useCopyToClipboard({
	copiedDuration = 3000,
}: {
	copiedDuration?: number;
} = {}) {
	const [isCopied, setIsCopied] = useState<boolean>(false);

	const copyToClipboard = (value: string) => {
		if (!value) return;

		navigator.clipboard.writeText(value).then(() => {
			setIsCopied(true);
			setTimeout(() => setIsCopied(false), copiedDuration);
		});
	};

	return { copyToClipboard, isCopied };
}

const defaultComponents = memoizeMarkdownComponents({
	a: ({ className, ...props }) => (
		<a
			className={cn(
				"font-medium text-primary underline underline-offset-4",
				className,
			)}
			{...props}
		/>
	),
	blockquote: ({ className, ...props }) => (
		<blockquote
			className={cn("border-l-2 pl-6 italic", className)}
			{...props}
		/>
	),
	CodeHeader,
	code: function Code({ className, ...props }) {
		const isCodeBlock = useIsMarkdownCodeBlock();
		return (
			<code
				className={cn(
					!isCodeBlock && "rounded border bg-muted font-semibold",
					className,
				)}
				{...props}
			/>
		);
	},
	h1: ({ className, ...props }) => (
		<h1
			className={cn(
				"mb-8 scroll-m-20 font-extrabold text-4xl tracking-tight last:mb-0",
				className,
			)}
			{...props}
		/>
	),
	h2: ({ className, ...props }) => (
		<h2
			className={cn(
				"mt-8 mb-4 scroll-m-20 font-semibold text-3xl tracking-tight first:mt-0 last:mb-0",
				className,
			)}
			{...props}
		/>
	),
	h3: ({ className, ...props }) => (
		<h3
			className={cn(
				"mt-6 mb-4 scroll-m-20 font-semibold text-2xl tracking-tight first:mt-0 last:mb-0",
				className,
			)}
			{...props}
		/>
	),
	h4: ({ className, ...props }) => (
		<h4
			className={cn(
				"mt-6 mb-4 scroll-m-20 font-semibold text-xl tracking-tight first:mt-0 last:mb-0",
				className,
			)}
			{...props}
		/>
	),
	h5: ({ className, ...props }) => (
		<h5
			className={cn(
				"my-4 font-semibold text-lg first:mt-0 last:mb-0",
				className,
			)}
			{...props}
		/>
	),
	h6: ({ className, ...props }) => (
		<h6
			className={cn("my-4 font-semibold first:mt-0 last:mb-0", className)}
			{...props}
		/>
	),
	hr: ({ className, ...props }) => (
		<hr className={cn("my-5 border-b", className)} {...props} />
	),
	ol: ({ className, ...props }) => (
		<ol
			className={cn("my-5 ml-6 list-decimal [&>li]:mt-2", className)}
			{...props}
		/>
	),
	p: ({ className, ...props }) => (
		<p
			className={cn("mt-5 mb-5 leading-7 first:mt-0 last:mb-0", className)}
			{...props}
		/>
	),
	pre: ({ className, ...props }) => (
		<pre
			className={cn(
				"!rounded-t-none overflow-x-auto rounded-b-lg bg-black p-4 text-white",
				className,
			)}
			{...props}
		/>
	),
	sup: ({ className, ...props }) => (
		<sup
			className={cn("[&>a]:text-xs [&>a]:no-underline", className)}
			{...props}
		/>
	),
	table: ({ className, ...props }) => (
		<table
			className={cn(
				"my-5 w-full border-separate border-spacing-0 overflow-y-auto",
				className,
			)}
			{...props}
		/>
	),
	td: ({ className, ...props }) => (
		<td
			className={cn(
				"border-b border-l px-4 py-2 text-left last:border-r [&[align=center]]:text-center [&[align=right]]:text-right",
				className,
			)}
			{...props}
		/>
	),
	th: ({ className, ...props }) => (
		<th
			className={cn(
				"bg-muted px-4 py-2 text-left font-bold first:rounded-tl-lg last:rounded-tr-lg [&[align=center]]:text-center [&[align=right]]:text-right",
				className,
			)}
			{...props}
		/>
	),
	tr: ({ className, ...props }) => (
		<tr
			className={cn(
				"m-0 border-b p-0 first:border-t [&:last-child>td:first-child]:rounded-bl-lg [&:last-child>td:last-child]:rounded-br-lg",
				className,
			)}
			{...props}
		/>
	),
	ul: ({ className, ...props }) => (
		<ul
			className={cn("my-5 ml-6 list-disc [&>li]:mt-2", className)}
			{...props}
		/>
	),
});
