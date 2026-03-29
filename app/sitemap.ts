import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const routes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  if (!process.env.DATABASE_URL) {
    return routes;
  }

  const trips = await prisma.trip.findMany({
    where: { published: true },
    select: {
      slug: true,
      updatedAt: true,
    },
  });

  for (const trip of trips) {
    routes.push({
      url: `${baseUrl}/${trip.slug}`,
      lastModified: trip.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  return routes;
}
