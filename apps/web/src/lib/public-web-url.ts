export function getPublicWebUrl(): string {
  const configured = process.env.PUBLIC_WEB_URL?.trim();

  if (configured) {
    return configured;
  }

  if (process.env.VERCEL_ENV === "production") {
    const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
    if (productionUrl) {
      return `https://${productionUrl}`;
    }
  }

  const previewUrl = process.env.VERCEL_URL?.trim();
  if (previewUrl) {
    return `https://${previewUrl}`;
  }

  return "http://localhost:3000";
}
