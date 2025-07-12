import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { PinoLogger } from "@mastra/loggers";
import { weatherAgent } from "./agents/weather-agent.js";
import { weatherWorkflow } from "./workflows/weather-workflow.js";

export const mastra = new Mastra({
	agents: { weatherAgent },
	logger: new PinoLogger({
		level: "info",
		name: "Mastra",
	}),
	storage: new LibSQLStore({
		// stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
		url: ":memory:",
	}),
	workflows: { weatherWorkflow },
});
