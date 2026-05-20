import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    pubDate: z.date(),
    description: z.string(),
    tags: z.array(z.string()).optional().default([]),
    category: z.string().optional().default('general'),
    draft: z.boolean().optional().default(false),
    pin: z.boolean().optional().default(false),
    image: z.object({
      path: z.string(),
      alt: z.string().optional().default(''),
    }).optional(),
  }),
});

export const collections = { posts };
