import { defineCollection, z } from "astro:content";

const resources = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    authors: z.array(z.string()).min(1),
    link: z.string().url(),
    createdAt: z.coerce.date(),
    image: z.string().optional(),
    image8bit: z.string().optional(),
    imageSource: z.string().url().optional(),
    imageLicense: z.string().optional(),
    tags: z.array(z.string()).min(1),
  }),
});

export const collections = {
  resources,
};
