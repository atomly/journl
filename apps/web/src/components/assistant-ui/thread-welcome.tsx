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

function getStableMessageIndex(seed: string, max: number) {
  let hash = 0;

  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash % max;
}

function getWelcomeMessage(user: User) {
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

  const shouldUseName = getStableMessageIndex(user.id, 10) < 7;
  const messagePool = shouldUseName ? withName : withoutName;

  return messagePool[getStableMessageIndex(user.id, messagePool.length)];
}

async function ThreadWelcomeMessage() {
  const user = await getUser();
  return (
    <p className="mt-4 text-center font-medium">{getWelcomeMessage(user)}</p>
  );
}
