import z from "zod";

export const zJournlAgentReasoning = z.enum(["instant", "thinking"]);

export type JournlReasoning = z.infer<typeof zJournlAgentReasoning>;

export function parseJournlAgentReasoning(value: unknown) {
  return zJournlAgentReasoning.parse(value);
}

export type GPTReasoningEffort = "minimal" | "medium";

export function getGPTReasoningEffort(
  mode: JournlReasoning,
): GPTReasoningEffort {
  switch (mode) {
    case "instant":
      return "minimal";
    case "thinking":
      return "medium";
    default:
      throw new Error(`Invalid reasoning mode: ${mode}`);
  }
}
