import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";
import sattertiIngredients from "./src/plugins/satteri-ingredients";
import { satteri } from '@astrojs/markdown-satteri';
import svelte from '@astrojs/svelte';

export default defineConfig({
  site: 'https://sondrebjarkum.github.io',
  base: '/',
  redirects: {
    "/oppskrifter": "/",
  },
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    processor: satteri({
      hastPlugins: [sattertiIngredients()]
    }),
  },
  integrations: [svelte()],
});
