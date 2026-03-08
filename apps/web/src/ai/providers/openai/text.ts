import { openai } from "@ai-sdk/openai";

export const miniModel = openai("gpt-5-mini");
export const nanoModel = openai("gpt-5-nano");
