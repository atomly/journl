/**
 * The context of the Journl agent.
 */
export type JournlAgentContext = {
  activeEditors: string[];
  currentDate: string;
  highlightedText: string[];
  view:
    | {
        name: "journal-timeline";
        /**
         * The date the user is focused on that the Journl agent will be aware of.
         */
        focusedDate?: string;
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
