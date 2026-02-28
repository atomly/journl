import { z } from "zod";
import { zTargetEditor } from "../manipulate-editor/schema";

export const zEditorChangesInput = z.object({
  targetEditor: zTargetEditor,
});
