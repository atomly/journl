import { ThreadPrimitive } from "@assistant-ui/react";
import { getUser, type User } from "~/auth/server";

export function ThreadWelcome() {
  return (
    <ThreadPrimitive.Empty>
      <div className="flex w-full max-w-[var(--thread-max-width)] flex-grow flex-col">
        <div className="flex w-full flex-grow flex-col items-center justify-center">
          <ThreadWelcomeMessage />
        </div>
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
