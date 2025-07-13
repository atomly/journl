"use client";

import { BlockEditor } from "~/components/editor/block-editor";

type PageBlocksProps = {
	parentId: string;
	parentType: "page" | "block";
};

export function PageBlocks({ parentId, parentType }: PageBlocksProps) {
	return <BlockEditor parentId={parentId} parentType={parentType} />;
}
