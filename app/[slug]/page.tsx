import { Chip } from "@nextui-org/react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GalleryLightbox } from "@/components/public/gallery-lightbox";
import { prisma } from "@/lib/prisma";

type TripDetailPageProps = {
  params: Promise<{ slug: string }>;
};

const resolveBaseUrl = () => process.env.NEXTAUTH_URL ?? "http://localhost:3000";

const isValidImageUrl = (value?: string | null) => {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const readMainImageUrl = (value: unknown): string | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = (value as { mainImageUrl?: unknown }).mainImageUrl;
  return typeof candidate === "string" ? candidate : null;
};

const readGalleryImageUrls = (value: unknown): string[] => {
  if (typeof value !== "object" || value === null) {
    return [];
  }

  const candidate = (value as { galleryImageUrls?: unknown }).galleryImageUrls;

  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate.filter((item): item is string => typeof item === "string");
};

const hasDatabaseUrl = () => {
  const databaseUrl = process.env.DATABASE_URL;
  return Boolean(databaseUrl && /^(postgresql|postgres):\/\//.test(databaseUrl));
};

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

  let trip = null;

  try {
    trip = await prisma.trip.findFirst({
      where: { slug, published: true },
      select: {
        title: true,
        description: true,
        slug: true,
        mainImageUrl: true,
      },
    });
  } catch {
    return {
      title: "Cestovatelsky denik",
      description: "Publikovane cestovatelske clanky.",
    };
  }

  if (!trip) {
    return {
      title: "Clanek nenalezen",
      description: "Pozadovany cestovatelsky denik nebyl nalezen.",
    };
  }

  const url = `${resolveBaseUrl()}/${trip.slug}`;
  const mainImageUrl = readMainImageUrl(trip);
  const openGraphImages =
    mainImageUrl && isValidImageUrl(mainImageUrl)
      ? [
          {
            url: mainImageUrl,
            width: 1600,
            height: 900,
            alt: `Nahled clanku ${trip.title}`,
          },
        ]
      : undefined;

  return {
    title: trip.title,
    description: trip.description,
    openGraph: {
      type: "article",
      title: trip.title,
      description: trip.description,
      url,
      images: openGraphImages,
    },
  };
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  if (!hasDatabaseUrl()) {
    notFound();
  }

  const { slug } = await params;

  let trip = null;

  try {
    trip = await prisma.trip.findFirst({
      where: { slug, published: true },
      select: {
        id: true,
        title: true,
        description: true,
        content: true,
        publishDate: true,
        mainImageUrl: true,
        galleryImageUrls: true,
        author: { select: { name: true } },
        tags: { select: { id: true, name: true } },
      },
    });
  } catch {
    notFound();
  }

  if (!trip) {
    notFound();
  }

  const heroImage = readMainImageUrl(trip);
  const galleryImageUrls = readGalleryImageUrls(trip);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="space-y-3">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          &larr; Zpet na clanky
        </Link>
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

      {heroImage && isValidImageUrl(heroImage) ? (
        <section>
          <img
            src={heroImage}
            alt={trip.title}
            className="h-auto w-full rounded-xl object-cover"
          />
        </section>
      ) : null}

      <article
        className="prose prose-slate max-w-none"
        dangerouslySetInnerHTML={{ __html: trip.content }}
      />

      <GalleryLightbox images={galleryImageUrls} title={`Galerie - ${trip.title}`} />
    </main>
  );
}
