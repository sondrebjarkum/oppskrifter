import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: 'https://sondrebjarkum.github.io',
  base: '/oppskrifter',
  vite: {
    plugins: [tailwindcss()],
  },
});
