import type { MetadataRoute } from "next";

const base = process.env.APP_BASE_URL ?? "http://localhost:3000";

// Izinkan landing + form opt-in publik. Blok semua area app (auth) & API.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/login",
          "/dashboard",
          "/inbox",
          "/contacts",
          "/broadcasts",
          "/templates",
          "/flows",
          "/ai-agent",
          "/reports",
          "/channels",
          "/settings",
          "/billing",
          "/checkout",
          "/profile",
          "/admin",
          "/api/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
