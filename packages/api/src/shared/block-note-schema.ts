import { z } from "zod/v4";

// Simply using `any` types as we aren't really changing the BlockNote schema anywhere.
export const zBlockNoteBlockType = z.any();
export const zBlockNoteBlockProps = z.any();
export const zBlockNoteInlineContent = z.any();
