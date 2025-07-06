import { Button } from "@acme/ui/components/button";
import { Card, CardContent } from "@acme/ui/components/card";
import { FileText, Plus, Search } from "lucide-react";
import { authGuard } from "~/auth/server";

export default async function Home() {
	const _session = await authGuard();

	return (
		<div className="min-h-screen bg-background p-6 text-foreground">
			<div className="mx-auto max-w-4xl">
				{/* Header */}
				<div className="mb-12 flex items-center gap-4">
					<div>
						<h1 className="font-bold text-3xl text-foreground">Journal</h1>
						<p className="text-lg text-muted-foreground">
							Your documents and memories in one place
						</p>
					</div>
				</div>

				{/* Action Buttons */}
				<div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
					<Button
						variant="outline"
						className="flex h-20 flex-col items-center justify-center gap-2 hover:bg-accent hover:text-accent-foreground"
					>
						<FileText className="h-6 w-6" />
						<span className="text-base">Journal Entry</span>
					</Button>
					<Button
						variant="outline"
						className="flex h-20 flex-col items-center justify-center gap-2 hover:bg-accent hover:text-accent-foreground"
					>
						<Plus className="h-6 w-6" />
						<span className="text-base">New Page</span>
					</Button>

					<Button
						variant="outline"
						className="flex h-20 flex-col items-center justify-center gap-2 hover:bg-accent hover:text-accent-foreground"
					>
						<Search className="h-6 w-6" />
						<span className="text-base">Search</span>
					</Button>
				</div>

				{/* Recent Pages Title */}
				<div className="mb-6">
					<h2 className="font-semibold text-foreground text-xl">
						Recent Pages
					</h2>
				</div>

				{/* Recent Documents */}
				<div className="space-y-4">
					<Card className="hover:bg-accent/50">
						<CardContent className="p-6">
							<div className="flex items-start gap-4">
								<div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded">
									<FileText className="h-4 w-4 text-primary" />
								</div>
								<div className="min-w-0 flex-1">
									<h3 className="mb-2 font-semibold text-foreground text-lg">
										Lorem Ipsum
									</h3>
									<p className="mb-3 text-muted-foreground text-sm leading-relaxed">
										Lorem Ipsum has been the industry's standard dummy text ever
										since the 1500s, when an unknown printer took a galley of
										type and scrambled it to make a type specimen book. It has
										survived not only five
									</p>
								</div>
								<div className="flex-shrink-0 text-muted-foreground text-sm">
									Jul 03 2025
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="hover:bg-accent/50">
						<CardContent className="p-6">
							<div className="flex items-start gap-4">
								<div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded">
									<FileText className="h-4 w-4 text-primary" />
								</div>
								<div className="min-w-0 flex-1">
									<h3 className="mb-2 font-semibold text-foreground text-lg">
										New Document
									</h3>
									<p className="text-muted-foreground text-sm">...</p>
								</div>
								<div className="flex-shrink-0 text-muted-foreground text-sm">
									Jul 05 2025
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
