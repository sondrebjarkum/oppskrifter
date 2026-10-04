import { defineCollection } from 'astro:content';
import { z } from 'astro/zod'
import { glob } from 'astro/loaders';

const recipes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: '../recipes' }),
  schema: z.object({
    title: z.string(),
    category: z.string().default('ukategorisert'),
    subcategory: z.string().optional(),
    timers: z.array(z.object({title: z.string(), time: z.number()})).optional()

  }),
});

export const collections = { recipes };