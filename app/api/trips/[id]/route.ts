import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateTripSchema } from "@/lib/validations/trip";

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

type Params = {
  params: Promise<{ id: string }>;
};

const unauthorizedResponse = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const forbiddenResponse = () =>
  NextResponse.json({ error: "Forbidden" }, { status: 403 });

async function assertOwnership(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, userId: true, title: true },
  });

  if (!trip) {
    return { status: "not-found" as const };
  }

  if (trip.userId !== userId) {
    return { status: "forbidden" as const };
  }

  return { status: "ok" as const };
}

async function updateTrip(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  const { id } = await params;
  const ownership = await assertOwnership(id, session.user.id);

  if (ownership.status === "not-found") {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  if (ownership.status === "forbidden") {
    return forbiddenResponse();
  }

  const body = await req.json();
  const parsed = updateTripSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { tags, mainImageUrl, galleryImageUrls, ...tripData } = parsed.data;
  const resolvedSlug = toTripSlug(tripData.title ?? ownership.title);

  if (!resolvedSlug) {
    return NextResponse.json(
      { error: "Validation failed", details: { slug: ["Slug cannot be empty"] } },
      { status: 400 },
    );
  }

  const normalizedTags = tags ? normalizeTags(tags) : undefined;
  const connectedTags = normalizedTags
    ? await Promise.all(
        normalizedTags.map((tag) =>
          prisma.tag.upsert({
            where: { slug: tag.slug },
            update: { name: tag.name },
            create: { name: tag.name, slug: tag.slug },
          }),
        ),
      )
    : undefined;

  const updatedTrip = await prisma.trip.update({
    where: { id },
    data: {
      ...tripData,
      slug: resolvedSlug,
      ...(mainImageUrl !== undefined ? { mainImageUrl } : {}),
      ...(galleryImageUrls !== undefined ? { galleryImageUrls } : {}),
      ...(connectedTags
        ? {
            tags: {
              set: connectedTags.map((tag) => ({ id: tag.id })),
            },
          }
        : {}),
    },
    include: { tags: true },
  });

  return NextResponse.json(updatedTrip);
}

export async function GET(_: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  const { id } = await params;
  const ownership = await assertOwnership(id, session.user.id);

  if (ownership.status === "not-found") {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  if (ownership.status === "forbidden") {
    return forbiddenResponse();
  }

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: { tags: true },
  });

  return NextResponse.json(trip);
}

export async function PUT(req: Request, context: Params) {
  return updateTrip(req, context);
}

export async function PATCH(req: Request, context: Params) {
  return updateTrip(req, context);
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  const { id } = await params;
  const ownership = await assertOwnership(id, session.user.id);

  if (ownership.status === "not-found") {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  if (ownership.status === "forbidden") {
    return forbiddenResponse();
  }

  await prisma.trip.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
