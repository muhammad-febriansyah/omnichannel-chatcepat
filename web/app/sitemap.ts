import type { MetadataRoute } from "next";

const base = process.env.APP_BASE_URL ?? "http://localhost:3000";

// Hanya halaman publik (landing). Area app di-gate auth → tidak diindeks.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
