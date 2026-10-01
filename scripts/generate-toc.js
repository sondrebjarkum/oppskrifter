import fs from 'node:fs';
import path from 'node:path';

const RECIPES_DIR = path.join(import.meta.dirname, 'recipes');
const OUTPUT_FILE = path.join(import.meta.dirname, 'index.md');

function parseRecipe(fileName) {
  const content = fs.readFileSync(path.join(RECIPES_DIR, fileName), 'utf8');

  // Extract category from front matter
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

  // Extract first H1 heading (single #) from the body
  const titleMatch = body.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : path.basename(fileName, '.md');

  return { category, title, link: `./recipes/${encodeURI(fileName)}` };
}

function generateToc() {
  const files = fs
    .readdirSync(RECIPES_DIR)
    .filter((f) => f.toLowerCase().endsWith('.md'));

  const recipes = files.map(parseRecipe);

  // Group by category
  const grouped = recipes.reduce((acc, recipe) => {
    (acc[recipe.category] ||= []).push(recipe);
    return acc;
  }, {});

  const compare = (a, b) => a.localeCompare(b, 'nb', { sensitivity: 'base' });

  let output = '# Innholdsfortegnelse\n';

  for (const category of Object.keys(grouped).sort(compare)) {
    const heading = category.charAt(0).toUpperCase() + category.slice(1);
    output += `\n## ${heading}\n\n`;

    grouped[category]
      .sort((a, b) => compare(a.title, b.title))
      .forEach((r) => {
        output += `- [${r.title}](${r.link})\n`;
      });
  }

  fs.writeFileSync(OUTPUT_FILE, output, 'utf8');
  console.log(`Table of contents written to ${OUTPUT_FILE} (${recipes.length} recipes)`);
}

generateToc();