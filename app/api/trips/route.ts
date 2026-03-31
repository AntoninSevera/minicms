import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTripSchema } from "@/lib/validations/trip";

const toTripSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const toTagSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const normalizeTags = (tags: string[]) => {
  const unique = new Map<string, { name: string; slug: string }>();

  for (const rawTag of tags) {
    const name = rawTag.trim();
    if (!name) {
      continue;
    }

    const slug = toTagSlug(name);
    if (!slug || unique.has(slug)) {
      continue;
    }

    unique.set(slug, { name, slug });
  }

  return Array.from(unique.values());
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trips = await prisma.trip.findMany({
    where: { userId: session.user.id },
    include: { tags: true },
    orderBy: { publishDate: "desc" },
  });

  return NextResponse.json(trips);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createTripSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { tags, mainImageUrl, galleryImageUrls, ...tripData } = parsed.data;
  const resolvedSlug = toTripSlug(parsed.data.title);

  if (!resolvedSlug) {
    return NextResponse.json(
      { error: "Validation failed", details: { slug: ["Slug cannot be empty"] } },
      { status: 400 },
    );
  }

  const normalizedTags = normalizeTags(tags ?? []);
  const connectedTags = await Promise.all(
    normalizedTags.map((tag) =>
      prisma.tag.upsert({
        where: { slug: tag.slug },
        update: { name: tag.name },
        create: { name: tag.name, slug: tag.slug },
      }),
    ),
  );

  const trip = await prisma.trip.create({
    data: {
      ...tripData,
      slug: resolvedSlug,
      mainImageUrl,
      galleryImageUrls,
      userId: session.user.id,
      ...(connectedTags.length > 0
        ? {
            tags: {
              connect: connectedTags.map((tag) => ({ id: tag.id })),
            },
          }
        : {}),
    },
    include: { tags: true },
  });

  return NextResponse.json(trip, { status: 201 });
}
