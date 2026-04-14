import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/projects/", "/admin/"],
      },
    ],
    sitemap: "https://usesplash.vercel.app/sitemap.xml",
    host: "https://usesplash.vercel.app",
  }
}
