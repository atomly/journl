import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#e9effb",
    description:
      "Organize useful knowledge, projects, recipes and references with Journl.",
    display: "standalone",
    icons: [
      {
        purpose: "any",
        sizes: "any",
        src: "/brand/mark-light.svg",
        type: "image/svg+xml",
      },
      { sizes: "48x48", src: "/brand/icon-light-48.png", type: "image/png" },
    ],
    id: "/",
    name: "Journl",
    scope: "/",
    short_name: "Journl",
    // Keep journal, pages, folders, and auth on the installation's origin.
    start_url: "/journal",
    theme_color: "#e9effb",
  };
}
