import type { MetadataRoute } from "next";
import { getPublicWebUrl } from "~/lib/public-web-url";

export default function robots(): MetadataRoute.Robots {
  const publicWebUrl = getPublicWebUrl();

  return {
    host: publicWebUrl,
    rules: {
      allow: "/",
      userAgent: "*",
    },
    sitemap: `${publicWebUrl}/sitemap.xml`,
  };
}
