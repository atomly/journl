import type { JournlReasoning } from "./journl-agent-reasoning";

/**
 * JournalEntryEditor ID in the format of: `journal-entry:{DATE}`.
 */
type JournalEntryEditor = `journal-entry:${string}`;

/**
 * PageEditor ID in the format of: `page:{ID}`.
 */
type PageEditor = `page:${string}`;

/**
 * The stage of the Journl agent.
 */
export type JournlAgentState = {
  activeEditors: (JournalEntryEditor | PageEditor)[];
  currentDate: string;
  highlightedText: string[];
  user: {
    name: string;
  };
  reasoning: JournlReasoning;
  view:
    | {
        name: "journal";
      }
    | {
        name: "journal-entry";
        /**
         * The date of the journal entry page the user is on that the Journl agent will be aware of.
         */
        date: string;
      }
    | {
        name: "page";
        /**
         * The ID of the page the user is on that the Journl agent will be aware of.
         */
        id: string;
        /**
         * The title of the page the user is on that the Journl agent will be aware of.
         */
        title: string;
      }
    | {
        name: "other";
      };
};
