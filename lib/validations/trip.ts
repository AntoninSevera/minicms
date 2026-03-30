import { z } from "zod";

const optionalImageUrl = z
  .string()
  .trim()
  .url()
  .or(z.literal(""))
  .transform((value) => value || undefined)
  .optional();

export const createTripSchema = z.object({
  title: z.string().trim().min(1, { message: "Toto pole je povinne" }),
  slug: z.string().trim().min(1, { message: "Toto pole je povinne" }),
  content: z.string().min(1, { message: "Toto pole je povinne" }),
  description: z.string().trim().min(1, { message: "Toto pole je povinne" }),
  mainImageUrl: optionalImageUrl,
  galleryImageUrls: z.array(z.string().trim().url()).optional().default([]),
  publishDate: z.coerce.date(),
  published: z.boolean().default(false),
  tagIds: z.array(z.string()).optional().default([]),
});

export const updateTripSchema = createTripSchema.partial();

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
