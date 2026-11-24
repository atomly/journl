import type { UIMessage } from "ai";
export const workspaceMessages: UIMessage[] = [
  {
    id: "garden-q1",
    parts: [{ text: "What should I plant this week?", type: "text" }],
    role: "user",
  },
  {
    id: "garden-a1",
    parts: [
      {
        text: "Start with parsley and loose-leaf lettuce. Both fit the rail planters and suit the three hours of morning sun you recorded.\n\nPut the basil in the floor pot by the warm wall. Your growing notes say to wait until nights stay above 13 °C.",
        type: "text",
      },
    ],
    role: "assistant",
  },
  {
    id: "garden-q2",
    parts: [{ text: "Which planter should I set up first?", type: "text" }],
    role: "user",
  },
  {
    id: "garden-a2",
    parts: [
      {
        text: "Set up Rail planter A first. Test the brackets before you fill it, then plant parsley and chives together.",
        type: "text",
      },
    ],
    role: "assistant",
  },
];
