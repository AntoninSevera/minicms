import { Chip } from "@nextui-org/react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

type TripDetailPageProps = {
  params: Promise<{ slug: string }>;
};

const resolveBaseUrl = () => process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const hasDatabaseUrl = () => Boolean(process.env.DATABASE_URL);

export async function generateStaticParams() {
  if (!hasDatabaseUrl()) {
    return [];
  }

  try {
    const latestTrips = await prisma.trip.findMany({
      where: { published: true },
      orderBy: { publishDate: "desc" },
      take: 20,
      select: { slug: true },
    });

    return latestTrips.map((trip) => ({ slug: trip.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: TripDetailPageProps): Promise<Metadata> {
  if (!hasDatabaseUrl()) {
    return {
      title: "Cestovatelsky denik",
      description: "Publikovane cestovatelske clanky.",
    };
  }

  const { slug } = await params;

  const trip = await prisma.trip.findFirst({
    where: { slug, published: true },
    select: {
      title: true,
      description: true,
      slug: true,
    },
  });

  if (!trip) {
    return {
      title: "Clanek nenalezen",
      description: "Pozadovany cestovatelsky denik nebyl nalezen.",
    };
  }

  const url = `${resolveBaseUrl()}/${trip.slug}`;

  return {
    title: trip.title,
    description: trip.description,
    openGraph: {
      type: "article",
      title: trip.title,
      description: trip.description,
      url,
    },
  };
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  if (!hasDatabaseUrl()) {
    notFound();
  }

  const { slug } = await params;

  const trip = await prisma.trip.findFirst({
    where: { slug, published: true },
    include: {
      author: { select: { name: true } },
      tags: { select: { id: true, name: true } },
    },
  });

  if (!trip) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">{trip.title}</h1>
        <p className="text-sm text-slate-500">
          {new Date(trip.publishDate).toLocaleDateString("cs-CZ")} · {trip.author.name ?? "Neznamy autor"}
        </p>
        <p className="text-lg text-slate-700">{trip.description}</p>
        <div className="flex flex-wrap gap-2">
          {trip.tags.map((tag) => (
            <Chip key={tag.id} size="sm" variant="flat">
              {tag.name}
            </Chip>
          ))}
        </div>
      </header>

      <article
        className="prose prose-slate max-w-none"
        dangerouslySetInnerHTML={{ __html: trip.content }}
      />
    </main>
  );
}
