export function ChatWelcome() {
  return (
    <div className="mx-auto flex min-h-80 max-w-96 flex-col items-center justify-center gap-5 px-6 py-12 text-center">
      <h2 className="font-semibold text-[30px] leading-tight tracking-tight">
        What would you like to explore?
      </h2>
      <p className="text-base text-muted-foreground leading-relaxed">
        Bring a note into the conversation, or start with a question.
      </p>
    </div>
  );
}
