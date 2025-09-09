import { z } from "zod";

export const zNavigatePageInput = z.object({
  id: z.string().uuid().describe("The id of the page to navigate to."),
});
