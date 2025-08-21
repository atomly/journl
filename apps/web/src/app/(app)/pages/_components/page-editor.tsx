"use client";

import type { BlockTransaction } from "@acme/api";
import type { Page } from "@acme/db/schema";
import type { PartialBlock } from "@blocknote/core";
import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { BlockEditor } from "~/components/editor/block-editor";
import { env } from "~/env";
import { useTRPC } from "~/trpc/react";

type PageEditorProps = {
	page: Pick<Page, "id" | "title" | "document_id">;
	initialBlocks: [PartialBlock, ...PartialBlock[]] | undefined;
	debounceTime?: number;
};

export function PageEditor({
	page,
	initialBlocks,
	debounceTime = 200,
}: PageEditorProps) {
	const trpc = useTRPC();
	const { mutate, isPending } = useMutation({
		...trpc.blocks.saveTransactions.mutationOptions({}),
		onSuccess: () => {
			if (pendingChangesRef.current.length > 0) {
				debouncedMutate();
			}
		},
	});
	const pendingChangesRef = useRef<BlockTransaction[]>([]);
	const debouncedMutate = useDebouncedCallback(() => {
		if (isPending) return;
		const transactions = pendingChangesRef.current;
		pendingChangesRef.current = [];
		mutate({ document_id: page.document_id, transactions });
	}, debounceTime);

	function handleEditorChange(transactions: BlockTransaction[]) {
		pendingChangesRef.current.push(...transactions);

		// Leaving this here for debugging purposes because this logic is a fucking mess.
		if (env.NODE_ENV === "development") {
			console.debug("saveTransactions 👀", {
				transactions: pendingChangesRef.current.map((t) =>
					t.type === "block_remove" || t.type === "block_upsert"
						? {
								...t,
								element: document.querySelector(`[data-id="${t.args.id}"]`),
							}
						: {
								...t,
								from_element: document.querySelector(
									`[data-id="${t.args.from_id}"]`,
								),
								to_element: document.querySelector(
									`[data-id="${t.args.to_id}"]`,
								),
							},
				),
			});
		}

		debouncedMutate();
	}

	return (
		<BlockEditor initialBlocks={initialBlocks} onChange={handleEditorChange} />
	);
}
