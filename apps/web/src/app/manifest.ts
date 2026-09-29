import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#ffffff",
    description:
      "Journl helps you capture thoughts, reflect with AI guidance, and turn daily notes into momentum.",
    display: "standalone",
    icons: [{ sizes: "any", src: "/favicon.ico", type: "image/x-icon" }],
    id: "/",
    name: "Journl",
    scope: "/",
    short_name: "Journl",
    // Keep journal, pages, folders, and auth on the installation's origin.
    start_url: "/journal",
    theme_color: "#ffffff",
  };
}
