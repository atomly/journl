import { HydrateClient } from "~/trpc/server";
import { CreatePostForm, PostList } from "../_components/posts";

export default function JournalPage() {
	return (
		<HydrateClient>
			<div className="container mx-auto px-4 py-6">
				<div className="space-y-6">
					<div>
						<h1 className="font-bold text-3xl tracking-tight">Journal</h1>
						<p className="text-muted-foreground">
							Welcome to your personal journal space.
						</p>
					</div>
					<CreatePostForm />
					<PostList />
				</div>
			</div>
		</HydrateClient>
	);
}
