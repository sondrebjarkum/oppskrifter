import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const ROOT_DIR = path.join(import.meta.dirname, '..');
const RECIPES_DIR = path.join(ROOT_DIR, 'recipes');
const TEMPLATE = `---
category: **category**
title: **title**
---

# **title**

## Ingredienser

## Fremgangsmåte
`;

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function generateRecipe(title, category) {
  const content = TEMPLATE
    .replaceAll('**title**', title)
    .replaceAll('**category**', category);

  const fileName = `${slugify(title)}.md`;
  const filePath = path.join(RECIPES_DIR, fileName);

  if (fs.existsSync(filePath)) {
    console.error(`Recipe already exists: ${filePath}`);
    process.exit(1);
  }

  fs.mkdirSync(RECIPES_DIR, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Created ${filePath}`);
}

const { values } = parseArgs({
  options: {
    title: { type: 'string', short: 't' },
    category: { type: 'string', short: 'c' },
  },
});

if (!values.title || !values.category) {
  console.error('Usage: pnpm recipe -t "<title>" -c <category>');
  process.exit(1);
}

generateRecipe(values.title.trim(), values.category.trim().toLowerCase());