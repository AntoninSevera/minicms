"use client";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Switch,
  Textarea,
} from "@nextui-org/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyboardEvent, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { deleteBlobImage, uploadImagesAction } from "@/app/lib/actions/upload";
import { RichTextEditor } from "@/components/dashboard/rich-text-editor";

type Tag = {
  id: string;
  name: string;
  slug: string;
};

type Trip = {
  id: string;
  title: string;
  slug: string;
  description: string;
  content: string;
  publishDate: string;
  published: boolean;
  mainImageUrl: string | null;
  galleryImageUrls: string[];
  tags: Tag[];
};

const tripFormSchema = z.object({
  title: z.string().trim().min(1, { message: "Toto pole je povinne" }),
  slug: z.string().trim().min(1, { message: "Toto pole je povinne" }),
  description: z.string().trim().min(1, { message: "Toto pole je povinne" }),
  content: z.string().min(1, { message: "Toto pole je povinne" }),
  mainImageUrl: z.string().optional(),
  galleryImageUrls: z.array(z.string()),
  tags: z.array(z.string()),
  publishDate: z.string().min(1, { message: "Toto pole je povinne" }),
  published: z.boolean(),
});

type FormValues = z.infer<typeof tripFormSchema>;

type TripFormProps = {
  mode: "create" | "edit";
  tripId?: string;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const toLocalDateTimeInputValue = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset() * 60_000;
  const localIso = new Date(date.getTime() - offset).toISOString();
  return localIso.slice(0, 16);
};

const fetchJson = async <T,>(input: RequestInfo, init?: RequestInit) => {
  const response = await fetch(input, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? "Request failed");
  }
  return (await response.json()) as T;
};

const isValidHttpUrl = (value?: string | null) => {
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

export function TripForm({ mode, tripId }: TripFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [lastAutoSlug, setLastAutoSlug] = useState("");
  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [mainImagePreviewUrl, setMainImagePreviewUrl] = useState<string | null>(null);
  const [galleryPreviewUrls, setGalleryPreviewUrls] = useState<string[]>([]);
  const [urlsToDelete, setUrlsToDelete] = useState<string[]>([]);

  const tripQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchJson<Trip>(`/api/trips/${tripId}`),
    enabled: mode === "edit" && Boolean(tripId),
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: {
      title: "",
      slug: "",
      description: "",
      content: "",
      mainImageUrl: "",
      galleryImageUrls: [],
      tags: [],
      publishDate: "",
      published: false,
    },
  });

  useEffect(() => {
    if (mode === "edit" && tripQuery.data) {
      reset({
        title: tripQuery.data.title,
        slug: tripQuery.data.slug,
        description: tripQuery.data.description,
        content: tripQuery.data.content,
        mainImageUrl: tripQuery.data.mainImageUrl ?? "",
        galleryImageUrls: tripQuery.data.galleryImageUrls ?? [],
        tags: tripQuery.data.tags.map((tag) => tag.name),
        publishDate: toLocalDateTimeInputValue(tripQuery.data.publishDate),
        published: tripQuery.data.published,
      });
      setTags(tripQuery.data.tags.map((tag) => tag.name));
      setTagInput("");
      setLastAutoSlug("");
      setMainImageFile(null);
      setGalleryFiles([]);
      setUrlsToDelete([]);
    }
  }, [mode, reset, tripQuery.data]);

  useEffect(() => {
    if (!mainImageFile) {
      setMainImagePreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(mainImageFile);
    setMainImagePreviewUrl(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [mainImageFile]);

  useEffect(() => {
    if (galleryFiles.length === 0) {
      setGalleryPreviewUrls([]);
      return;
    }

    const previewUrls = galleryFiles.map((file) => URL.createObjectURL(file));
    setGalleryPreviewUrls(previewUrls);

    return () => {
      previewUrls.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
    };
  }, [galleryFiles]);

  const titleValue = watch("title");
  const slugValue = watch("slug");
  const mainImageUrlValue = watch("mainImageUrl");
  const galleryImageUrlsValue = watch("galleryImageUrls");

  useEffect(() => {
    setValue("tags", tags, {
      shouldValidate: true,
      shouldDirty: false,
    });
  }, [tags, setValue]);

  const addUrlToDeleteQueue = (url?: string | null) => {
    if (!url) {
      return;
    }

    setUrlsToDelete((prev) => (prev.includes(url) ? prev : [...prev, url]));
  };

  useEffect(() => {
    if (mode !== "create") {
      return;
    }

    const generatedSlug = slugify(titleValue ?? "");
    const canAutoUpdate = !slugValue || slugValue === lastAutoSlug;

    if (canAutoUpdate && slugValue !== generatedSlug) {
      setValue("slug", generatedSlug, {
        shouldValidate: true,
        shouldDirty: true,
      });
      setLastAutoSlug(generatedSlug);
    }
  }, [mode, titleValue, slugValue, lastAutoSlug, setValue]);

  const addTag = (rawTag: string) => {
    const normalizedTag = rawTag.trim();
    if (!normalizedTag) {
      return;
    }

    setTags((prev) => {
      const exists = prev.some((tag) => tag.toLowerCase() === normalizedTag.toLowerCase());
      return exists ? prev : [...prev, normalizedTag];
    });
    setTagInput("");
  };

  const removeTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  };

  const handleTagInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(tagInput);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      let nextUrlsToDelete = [...urlsToDelete];
      let nextMainImageUrl = values.mainImageUrl;
      let nextGalleryImageUrls = values.galleryImageUrls.filter((item) => item.trim().length > 0);
      const nextTags = tags
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      if (mainImageFile) {
        if (values.mainImageUrl) {
          nextUrlsToDelete = nextUrlsToDelete.includes(values.mainImageUrl)
            ? nextUrlsToDelete
            : [...nextUrlsToDelete, values.mainImageUrl];
        }

        const formData = new FormData();
        formData.append("files", mainImageFile);

        const uploadedMainImage = await uploadImagesAction(formData);
        nextMainImageUrl = uploadedMainImage.urls[0] ?? nextMainImageUrl;
      }

      if (galleryFiles.length > 0) {
        const formData = new FormData();
        galleryFiles.forEach((file) => formData.append("files", file));

        const uploadedGallery = await uploadImagesAction(formData);
        nextGalleryImageUrls = [...nextGalleryImageUrls, ...uploadedGallery.urls];
      }

      const payload = {
        ...values,
        mainImageUrl: nextMainImageUrl || undefined,
        galleryImageUrls: nextGalleryImageUrls,
        tags: nextTags,
        publishDate: new Date(values.publishDate),
      };

      const deleteQueue = Array.from(new Set(nextUrlsToDelete));

      if (mode === "edit" && tripId) {
        const updatedTrip = await fetchJson(`/api/trips/${tripId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (deleteQueue.length > 0) {
          await Promise.allSettled(deleteQueue.map((url) => deleteBlobImage(url)));
        }

        return updatedTrip;
      }

      const createdTrip = await fetchJson("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (deleteQueue.length > 0) {
        await Promise.allSettled(deleteQueue.map((url) => deleteBlobImage(url)));
      }

      return createdTrip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      if (tripId) {
        queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      }
      setMainImageFile(null);
      setGalleryFiles([]);
      setUrlsToDelete([]);
      toast.success("Cesta byla uspesne ulozena.");
      router.push("/dashboard/trips");
      router.refresh();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Nepodarilo se ulozit cestu.");
    },
  });

  const onSubmit = (values: FormValues) => {
    saveMutation.mutate(values);
  };

  if (tripQuery.isLoading) {
    return <p className="text-sm text-slate-600">Nacitam data cesty...</p>;
  }

  return (
    <Card>
      <CardBody>
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <Input
            label="Title"
            placeholder="Nazev cesty"
            {...register("title")}
            isInvalid={Boolean(errors.title)}
            errorMessage={errors.title?.message}
          />

          <Controller
            control={control}
            name="slug"
            render={({ field }) => (
              <Input
                {...field}
                label="URL adresa (slug)"
                placeholder="napr-vikend-ve-stockholmu"
                description="Bude pouzito v adrese: /vikend-ve-stockholmu. Pokud nevyplnite, vygeneruje se automaticky z nazvu."
                value={field.value ?? ""}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                isInvalid={Boolean(errors.slug)}
                errorMessage={errors.slug?.message}
              />
            )}
          />

          <Textarea
            label="Description"
            placeholder="Kratky perex"
            {...register("description")}
            isInvalid={Boolean(errors.description)}
            errorMessage={errors.description?.message}
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium">Tagy / kategorie</label>
            <Input
              value={tagInput}
              onValueChange={setTagInput}
              onKeyDown={handleTagInputKeyDown}
              placeholder="Napis tag a stiskni Enter nebo ,"
              description="Tag se prida po stisku Enter nebo carky."
            />
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="rounded px-1 text-slate-600 hover:bg-slate-300 hover:text-slate-900"
                      aria-label={`Odstranit tag ${tag}`}
                    >
                      X
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Hlavni obrazek</p>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                setMainImageFile(event.target.files?.[0] ?? null);
              }}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-500">Povolene jsou pouze obrazky do velikosti 4 MB.</p>
          </div>

          {mainImagePreviewUrl || isValidHttpUrl(mainImageUrlValue) ? (
            <Card shadow="sm">
              <CardHeader className="flex items-center justify-between gap-2 pb-0 text-sm text-slate-600">
                <span>Nahled hlavniho obrazku</span>
                {isValidHttpUrl(mainImageUrlValue) ? (
                  <Button
                    type="button"
                    size="sm"
                    color="danger"
                    variant="flat"
                    onClick={() => {
                      addUrlToDeleteQueue(mainImageUrlValue);
                      setValue("mainImageUrl", "", {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                  >
                    Odstranit hlavni obrazek
                  </Button>
                ) : null}
              </CardHeader>
              <CardBody>
                <img
                  src={mainImagePreviewUrl ?? mainImageUrlValue}
                  alt="Nahled hlavniho obrazku"
                  className="h-44 w-full rounded-lg object-cover"
                />
              </CardBody>
            </Card>
          ) : null}

          <Card shadow="sm">
            <CardHeader className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Galerie obrazku</span>
            </CardHeader>
            <CardBody className="space-y-3">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  setGalleryFiles(Array.from(event.target.files ?? []));
                }}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <p className="text-xs text-slate-500">Vyberte jeden nebo vice obrazku pro galerii (max 4 MB / soubor).</p>

              {(galleryImageUrlsValue ?? []).length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Aktualne ulozene obrazky</p>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {galleryImageUrlsValue.map((galleryUrl, index) => (
                      <div key={`${galleryUrl}-${index}`} className="relative">
                        <img
                          src={galleryUrl}
                          alt={`Ulozena galerie ${index + 1}`}
                          className="h-28 w-full rounded-lg object-cover"
                        />
                        <Button
                          type="button"
                          size="sm"
                          color="danger"
                          variant="solid"
                          className="absolute right-2 top-2 min-w-0 px-2"
                          onClick={() => {
                            addUrlToDeleteQueue(galleryUrl);
                            setValue(
                              "galleryImageUrls",
                              (galleryImageUrlsValue ?? []).filter((_, itemIndex) => itemIndex !== index),
                              {
                                shouldDirty: true,
                                shouldValidate: true,
                              },
                            );
                          }}
                        >
                          X
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {galleryPreviewUrls.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Nahled novych souboru</p>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {galleryPreviewUrls.map((previewUrl, index) => (
                      <img
                        key={`${previewUrl}-${index}`}
                        src={previewUrl}
                        alt={`Nahled galerie ${index + 1}`}
                        className="h-28 w-full rounded-lg object-cover"
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Controller
            control={control}
            name="content"
            render={({ field }) => (
              <div>
                <p className="mb-2 text-sm font-medium">Content</p>
                <RichTextEditor value={field.value} onChange={field.onChange} />
                {errors.content?.message ? (
                  <p className="mt-2 text-xs text-danger">{errors.content.message}</p>
                ) : null}
              </div>
            )}
          />

          <Input
            label="Publish Date"
            type="datetime-local"
            {...register("publishDate")}
            isInvalid={Boolean(errors.publishDate)}
            errorMessage={errors.publishDate?.message}
          />

          <Controller
            control={control}
            name="published"
            render={({ field }) => (
              <Switch isSelected={field.value} onValueChange={field.onChange}>
                Publikovano
              </Switch>
            )}
          />

          <div className="flex gap-3">
            <Button
              color="primary"
              type="submit"
              isLoading={isSubmitting || saveMutation.isPending}
            >
              Ulozit
            </Button>
            <Button as={Link} href="/dashboard/trips" variant="flat">
              Zrusit
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
