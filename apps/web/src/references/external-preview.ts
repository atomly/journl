import { githubProvider } from "./github-provider";
import { createPreviewPipeline } from "./preview-pipeline";
import { websiteProvider } from "./website-provider";
export const externalPreviews = createPreviewPipeline([
  githubProvider,
  websiteProvider,
]);
