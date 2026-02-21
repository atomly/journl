import type { MetadataRoute } from "next";
import { env } from "~/env";

export default function robots(): MetadataRoute.Robots {
  return {
    host: env.PUBLIC_WEB_URL,
    rules: {
      allow: "/",
      userAgent: "*",
    },
    sitemap: `${env.PUBLIC_WEB_URL}/sitemap.xml`,
  };
}
