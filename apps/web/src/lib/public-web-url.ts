import { env } from "~/env";

export function getPublicWebUrl(): string {
  const configured = env.PUBLIC_WEB_URL?.trim();

  if (configured) {
    return configured;
  }

  if (env.VERCEL_ENV === "production") {
    const productionUrl = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
    if (productionUrl) {
      return `https://${productionUrl}`;
    }
  }

  const previewUrl = env.VERCEL_URL?.trim();
  if (previewUrl) {
    return `https://${previewUrl}`;
  }

  return "http://localhost:3000";
}
