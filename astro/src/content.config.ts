import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const recipes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: '../recipes' }),
  schema: z.object({
    category: z.string().default('ukategorisert'),
    subcategory: z.string().optional(),
    title: z.string().optional(),
  }),
});

export const collections = { recipes };