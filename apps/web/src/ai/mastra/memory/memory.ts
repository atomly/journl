import { Memory } from "@mastra/memory";
import { miniModel } from "~/ai/providers/openai/text";
import { model as embedder } from "../../providers/openai/embedding";
import { journlStore } from "./store";
import { journlVector } from "./vector";

const JOURNL_MEMORY_LAST_MESSAGES = 30;
const JOURNL_OBSERVATIONAL_MEMORY_SCOPE = "resource";
const JOURNL_OBSERVATIONAL_TOKENS = 30000;
const JOURNL_REFLECTION_TOKENS = 40000;
const JOURNL_WORKING_MEMORY_SCOPE = "resource";
const JOURNL_WORKING_MEMORY_TEMPLATE = `## Preferences

- Communication Style: [e.g., Formal, Casual]
- Key Deadlines & Reminders:
  - [Item 1]: [Date]
  - [Item 2]: [Date]

## Session state

- Last Topic Discussed:
- Open Questions:
  - [Question 1]
  - [Question 2]
`;

export const journlMemory = new Memory({
  embedder,
  options: {
    lastMessages: JOURNL_MEMORY_LAST_MESSAGES,
    observationalMemory: {
      enabled: false,
      model: miniModel,
      observation: {
        // when to run the Observer
        messageTokens: JOURNL_OBSERVATIONAL_TOKENS,
      },
      reflection: {
        // when to run the Reflector
        observationTokens: JOURNL_REFLECTION_TOKENS,
      },
      scope: JOURNL_OBSERVATIONAL_MEMORY_SCOPE,
      // let message history borrow from observation budget,
      // disabling to free context window space for the messaging history, etc.
      shareTokenBudget: false,
    },
    workingMemory: {
      enabled: true,
      scope: JOURNL_WORKING_MEMORY_SCOPE,
      template: JOURNL_WORKING_MEMORY_TEMPLATE,
    },
  },
  storage: journlStore,
  vector: journlVector,
});
