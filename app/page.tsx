import { Card, CardBody, CardHeader, Chip } from "@nextui-org/react";
import Image from "next/image";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type HomePageProps = {
  searchParams: Promise<{ tag?: string }>;
};

const hasValidDatabaseUrl = () => {
  const databaseUrl = process.env.DATABASE_URL;
  return Boolean(databaseUrl && /^(postgresql|postgres):\/\//.test(databaseUrl));
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const { tag } = await searchParams;
  const hasDatabaseUrl = hasValidDatabaseUrl();

  const where: Prisma.TripWhereInput = {
    published: true,
    ...(tag
      ? {
          tags: {
            some: { slug: tag },
          },
        }
      : {}),
  };

  const [trips, tags] = hasDatabaseUrl
    ? await Promise.all([
        prisma.trip.findMany({
          where,
          include: {
            author: { select: { name: true } },
            tags: { select: { id: true, name: true, slug: true } },
          },
          orderBy: { publishDate: "desc" },
        }),
        prisma.tag.findMany({
          where: {
            trips: {
              some: {
                published: true,
              },
            },
          },
          orderBy: { name: "asc" },
        }),
      ]).catch(() => [[], []])
    : [[], []];

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold">Cestovatelsky denik</h1>
        <p className="text-slate-600">
          Verejne publikovane clanky z cest. Filtruj podle stitku.
        </p>
      </section>

      <section className="flex flex-wrap gap-2">
        <Chip
          as={Link}
          href="/"
          color={!tag ? "primary" : "default"}
          variant={!tag ? "solid" : "flat"}
        >
          Vse
        </Chip>
        {tags.map((item) => (
          <Chip
            as={Link}
            key={item.id}
            href={`/?tag=${encodeURIComponent(item.slug)}`}
            color={tag === item.slug ? "primary" : "default"}
            variant={tag === item.slug ? "solid" : "flat"}
          >
            {item.name}
          </Chip>
        ))}
      </section>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {!hasDatabaseUrl ? (
          <p className="text-sm text-slate-600">
            Databaze neni nakonfigurovana. Nastav DATABASE_URL pro nacteni obsahu.
          </p>
        ) : null}
        {trips.map((trip) => (
          <Card key={trip.id} as={Link} href={`/${trip.slug}`} className="hover:shadow-md">
            <CardHeader className="pb-0">
              <div>
                <h2 className="text-lg font-semibold">{trip.title}</h2>
                <p className="text-xs text-slate-500">
                  {new Date(trip.publishDate).toLocaleDateString("cs-CZ")} · {trip.author.name ?? "Neznamy autor"}
                </p>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="relative h-40 w-full overflow-hidden rounded-xl">
                <Image
                  alt={`Nahled cesty: ${trip.title}`}
                  src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover"
                  priority={false}
                />
              </div>
              <p className="line-clamp-3 text-sm text-slate-700">{trip.description}</p>
              <div className="flex flex-wrap gap-2">
                {trip.tags.map((tripTag) => (
                  <Chip key={tripTag.id} size="sm" variant="flat">
                    {tripTag.name}
                  </Chip>
                ))}
              </div>
            </CardBody>
          </Card>
        ))}
      </section>
    </main>
  );
}
