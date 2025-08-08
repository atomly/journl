"use client";

import { LazyBlockEditor } from "~/components/editor/lazy-block-editor";

type PageEditorProps = {
	id: string;
};

export function PageEditor({ id }: PageEditorProps) {
	return (
		<div className="flex h-full flex-col gap-4 p-4">
			<div className="min-h-0 flex-1">
				<LazyBlockEditor parentId={id} parentType="page" />
			</div>
		</div>
	);
}
