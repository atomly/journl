import { Mastra } from "@mastra/core";
import { journalAgent } from "./journal/journal-agent";
import { orchestratorAgent } from "./orchestrator/orchestrator-agent";
import { pageAgent } from "./page/page-agent";

export const mastra = new Mastra({
	agents: {
		journalAgent,
		orchestratorAgent,
		pageAgent,
	},
});

// Export individual agents for direct access if needed
export { journalAgent, orchestratorAgent, pageAgent };
