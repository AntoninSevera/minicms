"use server";

import { del, put } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

const sanitizeFileName = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "");

export async function uploadImagesAction(formData: FormData): Promise<{ urls: string[] }> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Neautorizovany pristup k uploadu.");
  }

  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) {
    return { urls: [] };
  }

  const uploadedUrls: string[] = [];

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Nahravat lze pouze soubory typu obrazek.");
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error("Maximalni velikost jednoho obrazku je 4 MB.");
    }

    const extension = file.name.includes(".") ? file.name.split(".").pop() ?? "jpg" : "jpg";
    const safeName = sanitizeFileName(file.name.replace(/\.[^.]+$/, ""));
    const blobPath = `trips/${session.user.id}/${Date.now()}-${safeName || "image"}.${extension}`;

    const uploaded = await put(blobPath, file, {
      access: "public",
    });

    uploadedUrls.push(uploaded.url);
  }

  return { urls: uploadedUrls };
}

export async function deleteBlobImage(url: string): Promise<{ deleted: boolean }> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Neautorizovany pristup ke smazani souboru.");
  }

  try {
    await del(url);
    return { deleted: true };
  } catch {
    return { deleted: false };
  }
}
