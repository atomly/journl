"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useTRPC } from "~/trpc/react";

export default function SearchPage() {
	const [query, setQuery] = useState("");
	const [searchQuery, setSearchQuery] = useState("");

	const trpc = useTRPC();
	const { data, isLoading, error, refetch } = useQuery({
		...trpc.journal.getRelevantEntries.queryOptions({
			limit: 10,
			query,
			threshold: 0.1,
		}),
		enabled: false,
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const input = query.trim();
		if (input) setSearchQuery(input);
		refetch();
	};

	return (
		<div className="container mx-auto max-w-4xl p-6">
			<div className="mb-6">
				<h1 className="font-bold text-3xl">Search Similar Journal Entries</h1>
				<p className="text-muted-foreground">
					Find journal entries with similar content using semantic search
				</p>
			</div>

			{/* Search Form */}
			<Card className="mb-6">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Search className="h-5 w-5" />
						Search Query
					</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="query">
								Enter text to find similar journal entries
							</Label>
							<Textarea
								id="query"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="e.g., 'feeling anxious about work' or 'excited about new project'"
								rows={3}
							/>
						</div>
						<Button type="submit" disabled={!query.trim() || isLoading}>
							{isLoading ? "Searching..." : "Search Similar Entries"}
						</Button>
					</form>
				</CardContent>
			</Card>

			{/* Results Section */}
			{searchQuery && (
				<div className="space-y-4">
					<div>
						<h2 className="font-semibold text-2xl">
							Results for: "{searchQuery}"
						</h2>
					</div>

					{isLoading && (
						<Card>
							<CardContent className="flex items-center justify-center py-8">
								<div className="flex items-center gap-2">
									<div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
									<span className="text-muted-foreground">Searching...</span>
								</div>
							</CardContent>
						</Card>
					)}

					{error && (
						<Card className="border-destructive">
							<CardContent className="pt-6">
								<p className="text-destructive">Error: {error.message}</p>
							</CardContent>
						</Card>
					)}

					{data && (
						<div className="space-y-4">
							{data.length === 0 ? (
								<Card>
									<CardContent className="py-8 text-center">
										<p className="text-muted-foreground">
											No similar entries found. Try adjusting your search query.
										</p>
									</CardContent>
								</Card>
							) : (
								<div className="space-y-4">
									{data.map((entry) => (
										<Card
											key={entry.id}
											className="transition-shadow hover:shadow-md"
										>
											<CardHeader className="pb-3">
												<div className="flex items-start justify-between">
													<time className="text-muted-foreground text-sm">
														{new Date(entry.date).toLocaleDateString()}
													</time>
													<Badge variant="secondary">
														{Math.round(entry.similarity * 100)}% similar
													</Badge>
												</div>
											</CardHeader>
											<CardContent>
												<p className="whitespace-pre-wrap leading-relaxed">
													{entry.content}
												</p>
											</CardContent>
										</Card>
									))}
								</div>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
