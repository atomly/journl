"use client";

import type { RouterOutputs } from "@acme/api";
import { CreatePostSchema } from "@acme/db/schema";
import { Button } from "@acme/ui/components/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormMessage,
	useForm,
} from "@acme/ui/components/form";
import { Input } from "@acme/ui/components/input";
import { toast } from "@acme/ui/components/toast";
import { cn } from "@acme/ui/lib/utils";
import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server";

import { useTRPC } from "~/trpc/react.js";

export function CreatePostForm() {
	const trpc = useTRPC();
	const form = useForm({
		defaultValues: {
			content: "",
			title: "",
		},
		schema: CreatePostSchema,
	});

	const queryClient = useQueryClient();
	const createPost = useMutation(
		trpc.post.create.mutationOptions({
			onError: (err: { data?: { code?: TRPC_ERROR_CODE_KEY } }) => {
				toast.error(
					err.data?.code === "UNAUTHORIZED"
						? "You must be logged in to post"
						: "Failed to create post",
				);
			},
			onSuccess: async () => {
				form.reset();
				await queryClient.invalidateQueries(trpc.post.pathFilter());
			},
		}),
	);

	return (
		<Form {...form}>
			<form
				className="flex w-full max-w-2xl flex-col gap-4"
				onSubmit={form.handleSubmit(() => {
					createPost.mutate();
				})}
			>
				<FormField
					control={form.control}
					name="title"
					render={({ field }) => (
						<FormItem>
							<FormControl>
								<Input {...field} placeholder="Title" />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="content"
					render={({ field }) => (
						<FormItem>
							<FormControl>
								<Input {...field} placeholder="Content" />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button>Create</Button>
			</form>
		</Form>
	);
}

export function PostList() {
	const trpc = useTRPC();
	useSuspenseQuery(trpc.post.all.queryOptions());

	return (
		<div className="flex w-full flex-col gap-4">
			<PostCard
				post={{
					content: "Test",
					createdAt: new Date(),
					id: "1",
					title: "Test",
				}}
			/>
		</div>
	);
}

export function PostCard(props: {
	post: RouterOutputs["post"]["all"][number];
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const deletePost = useMutation(
		trpc.post.delete.mutationOptions({
			onError: (err: { data?: { code?: TRPC_ERROR_CODE_KEY } }) => {
				toast.error(
					err.data?.code === "UNAUTHORIZED"
						? "You must be logged in to delete a post"
						: "Failed to delete post",
				);
			},
			onSuccess: async () => {
				await queryClient.invalidateQueries(trpc.post.pathFilter());
			},
		}),
	);

	return (
		<div className="flex flex-row rounded-lg bg-muted p-4">
			<div className="grow">
				<h2 className="text-2xl font-bold text-primary">{props.post.title}</h2>
				<p className="mt-2 text-sm">{props.post.content}</p>
			</div>
			<div>
				<Button
					variant="ghost"
					className="cursor-pointer text-sm font-bold uppercase text-primary hover:bg-transparent hover:text-white"
					onClick={() => deletePost.mutate(props.post.id)}
				>
					Delete
				</Button>
			</div>
		</div>
	);
}

export function PostCardSkeleton(props: { pulse?: boolean }) {
	const { pulse = true } = props;
	return (
		<div className="flex flex-row rounded-lg bg-muted p-4">
			<div className="grow">
				<div
					className={cn(
						"w-1/4 rounded bg-primary text-2xl font-bold",
						pulse && "animate-pulse",
					)}
				>
					&nbsp;
				</div>
				<p
					className={cn(
						"mt-2 w-1/3 rounded bg-current text-sm",
						pulse && "animate-pulse",
					)}
				>
					&nbsp;
				</p>
			</div>
		</div>
	);
}
