import { z } from "zod";

export const zCreatePageInput = z.object({
  title: z.string().describe("The title of the page to create."),
});
