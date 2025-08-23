import { notFound } from "next/navigation";
import { Suspense } from "react";
import { api } from "~/trpc/server";
import { DynamicPageEditor } from "../_components/page-editor.dynamic";
import { PageTitleInput } from "../_components/page-title-input";

export default async function Page({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const page = await api.pages.getById({ id });

	if (!page) {
		notFound();
	}

	return (
		<div className="flex h-full flex-col gap-4 p-4">
			<div className="min-h-0 flex-1">
				<PageTitleInput
					page={{
						id: page.id,
						title: page.title,
					}}
					className="mb-4 pl-13"
				/>
				<Suspense>
					<DynamicPageEditor
						page={{
							document_id: page.document_id,
							id: page.id,
							title: page.title,
						}}
						initialBlocks={page.document}
					/>
				</Suspense>
			</div>
		</div>
	);
}
