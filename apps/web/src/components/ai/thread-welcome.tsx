import { ThreadPrimitive } from "@assistant-ui/react";
import { getUser, type User } from "~/auth/server";

export function ThreadWelcome() {
	return (
		<ThreadPrimitive.Empty>
			<div className="flex w-full max-w-[var(--thread-max-width)] flex-grow flex-col">
				<div className="flex w-full flex-grow flex-col items-center justify-center">
					<ThreadWelcomeMessage />
				</div>
				<ThreadWelcomeSuggestions />
			</div>
		</ThreadPrimitive.Empty>
	);
}

function getRandomMessage(user: User) {
	const withName = [
		`What did you get done today, ${user.name}?`,
		`What went well today, ${user.name}?`,
		`${user.name}, anything blocking you right now?`,
		`What's different about today, ${user.name}?`,
		`${user.name}, what's on your mind?`,
		`Hey ${user.name}, how's it going?`,
		`Good to see you, ${user.name}!`,
		`Welcome back, ${user.name}!`,
		`${user.name}, what's new?`,
	];

	const withoutName = [
		"What did you do today?",
		"What's your plan for tomorrow?",
		"What went sideways today?",
		"What's stuck in your head?",
		"What are you working through?",
		"What happened today?",
		"What's next on your list?",
		"What's bugging you?",
		"Hey there! What's up?",
		"Good to see you back!",
		"Welcome back!",
		"What's new?",
	];

	// Use name 70% of the time, skip it 30% for variety
	const useNamedMessage = Math.random() > 0.3;
	const messagePool = useNamedMessage ? withName : withoutName;

	return messagePool[Math.floor(Math.random() * messagePool.length)];
}

async function ThreadWelcomeMessage() {
	const user = await getUser();
	return <p className="mt-4 font-medium">{getRandomMessage(user)}</p>;
}

function getRandomSuggestions() {
	const suggestions = [
		// Temporal searches
		{
			display: "What did I write yesterday?",
			prompt: "What did I write yesterday?",
		},
		{
			display: "Show me this week's entries",
			prompt: "Show me this week's entries",
		},
		{
			display: "What was I thinking last month?",
			prompt: "What was I thinking last month?",
		},
		{
			display: "Find my recent breakthroughs",
			prompt: "Find my recent breakthroughs",
		},

		// Pattern/theme searches
		{
			display: "What patterns do you see?",
			prompt: "What patterns do you see in my writing?",
		},
		{
			display: "What themes come up most?",
			prompt: "What themes come up most often?",
		},
		{
			display: "Find mentions of work stress",
			prompt: "Find mentions of work stress",
		},
		{ display: "Show me my mood patterns", prompt: "Show me my mood patterns" },

		// Reflection prompts
		{
			display: "What am I learning?",
			prompt: "What am I learning about myself?",
		},
		{ display: "How have I grown lately?", prompt: "How have I grown lately?" },
		{
			display: "What questions keep coming up?",
			prompt: "What questions keep coming up?",
		},
		{
			display: "What's been weighing on me?",
			prompt: "What's been weighing on me?",
		},

		// Creative/knowledge work
		{
			display: "Find my best ideas",
			prompt: "Find my best ideas from this month",
		},
		{
			display: "Show me unfinished thoughts",
			prompt: "Show me unfinished thoughts",
		},
		{
			display: "What projects excite me?",
			prompt: "What projects am I excited about?",
		},
		{
			display: "Find insights about productivity",
			prompt: "Find insights about productivity",
		},
	];

	// Shuffle and return 2 random suggestions
	const shuffled = suggestions.sort(() => Math.random() - 0.5);
	return shuffled.slice(0, 2);
}

function ThreadWelcomeSuggestions() {
	const suggestions = getRandomSuggestions();

	return (
		<div className="mt-3 grid w-full grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
			{suggestions.map((suggestion) => (
				<ThreadPrimitive.Suggestion
					key={suggestion.prompt}
					className="flex flex-col items-center justify-center rounded-lg border p-3 transition-colors ease-in hover:bg-muted/80"
					prompt={suggestion.prompt}
					method="replace"
					autoSend
				>
					<span className="text-center font-semibold text-sm leading-tight">
						{suggestion.display}
					</span>
				</ThreadPrimitive.Suggestion>
			))}
		</div>
	);
}
