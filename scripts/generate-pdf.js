import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import puppeteer from 'puppeteer';

const ROOT_DIR = path.join(import.meta.dirname, '..');
const RECIPES_DIR = path.join(ROOT_DIR, 'recipes');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const OUTPUT_FILE = path.join(DIST_DIR, 'oppskrifter.pdf');

const compare = (a, b) => a.localeCompare(b, 'nb', { sensitivity: 'base' });

function parseRecipe(fileName) {
  const content = fs.readFileSync(path.join(RECIPES_DIR, fileName), 'utf8');

  let category = 'ukategorisert';
  let body = content;
  const frontMatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (frontMatterMatch) {
    const categoryMatch = frontMatterMatch[1].match(/^category:\s*(.+)$/m);
    if (categoryMatch) {
      category = categoryMatch[1].trim().replace(/^["']|["']$/g, '');
    }
    body = content.slice(frontMatterMatch[0].length);
  }

  const titleMatch = body.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : path.basename(fileName, '.md');

  return { category, title, body: body.trim() };
}

function buildHtml(recipes) {
  const articles = recipes
    .map((r) => `<article class="recipe">${marked.parse(r.body)}</article>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="utf-8">
<style>
  body { font-family: Georgia, serif; font-size: 13pt; line-height: 1.5; color: #000; }
  h1 { font-size: 24pt; border-bottom: 1px solid #000; padding-bottom: 4px; margin-top: 0; }
  h2 { font-size: 16pt; margin-top: 1.2em; }
  li { margin: 3px 0; }
  .recipe { break-after: page; }
  .recipe:last-child { break-after: auto; }
</style>
</head>
<body>
${articles}
</body>
</html>`;
}

async function generatePdf() {
  const recipes = fs
    .readdirSync(RECIPES_DIR)
    .filter((f) => f.toLowerCase().endsWith('.md'))
    .map(parseRecipe)
    .sort((a, b) => compare(a.category, b.category) || compare(a.title, b.title));

  fs.mkdirSync(DIST_DIR, { recursive: true });

  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(buildHtml(recipes), { waitUntil: 'load' });
    await page.pdf({
      path: OUTPUT_FILE,
      format: 'A4',
      // Wider left margin for binder holes
      margin: { top: '20mm', bottom: '20mm', left: '30mm', right: '20mm' },
    });
  } finally {
    await browser.close();
  }

  console.log(`PDF written to ${OUTPUT_FILE} (${recipes.length} recipes)`);
}

generatePdf();