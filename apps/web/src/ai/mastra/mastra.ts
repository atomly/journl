import { Mastra } from "@mastra/core";
import { journlMini, journlNano } from "./agents/journl-agent";
import { journlStore } from "./memory/store";

export const mastra = new Mastra({
  agents: {
    journlMini,
    journlNano,
  },
  storage: journlStore,
});
