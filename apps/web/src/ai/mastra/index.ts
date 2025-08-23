import { Mastra } from "@mastra/core";
import { journlAgent } from "./agents/journl-agent";

export const mastra = new Mastra({
  agents: {
    journalAgent: journlAgent,
  },
});
