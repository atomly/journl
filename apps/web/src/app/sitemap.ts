import type { MetadataRoute } from "next";
import { getPublicWebUrl } from "~/lib/public-web-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getPublicWebUrl().replace(/\/$/, "");
  const now = new Date();

  return [
    {
      changeFrequency: "weekly",
      lastModified: now,
      priority: 1,
      url: `${baseUrl}/`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.7,
      url: `${baseUrl}/auth/sign-in`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.7,
      url: `${baseUrl}/invite`,
    },
  ];
}
