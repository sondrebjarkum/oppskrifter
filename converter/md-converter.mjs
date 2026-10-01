import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const PAGE_DIVIDER = /^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/m;
const SECTION_HEADINGS = ['ingredienser', 'fremgangsmåte'];

/**
 * Splits the raw text into individual recipe chunks using the page divider.
 */
function splitRecipes(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split(PAGE_DIVIDER)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

/**
 * Converts a single recipe chunk to markdown.
 */
function recipeToMarkdown(chunk) {
  const lines = chunk.split('\n');
  const titleIndex = lines.findIndex((line) => line.trim().length > 0);
  const title = lines[titleIndex].trim();

  let currentSection = null;

  const body = lines.slice(titleIndex + 1).map((line) => {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();

    if (SECTION_HEADINGS.includes(lower)) {
      currentSection = lower;
      return `\n## ${trimmed}\n`;
    }

    if (currentSection === 'ingredienser' && trimmed.length > 0) {
      return trimmed.startsWith('- ') ? trimmed : `- ${trimmed}`;
    }

    return line;
  });

  return {
    title,
    markdown: `# ${title}\n${body.join('\n')}\n`,
  };
}

/**
 * Creates a filesystem-friendly filename from a recipe title.
 */
function toFileName(title) {
  const slug = title
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'oppskrift'}.md`;
}

/**
 * Converts the full text into a list of { title, fileName, markdown }.
 */
function convert(text) {
  return splitRecipes(text).map((chunk) => {
    const { title, markdown } = recipeToMarkdown(chunk);
    return { title, fileName: toFileName(title), markdown };
  });
}

/**
 * Builds an index.md with links to all recipes, sorted alphabetically.
 */
function toIndexMarkdown(recipes) {
  const links = [...recipes]
    .sort((a, b) => a.title.localeCompare(b.title, 'nb'))
    .map(({ title, fileName }) => `- [${title}](./${encodeURI(fileName)})`);

  return `# Oppskrifter\n\n${links.join('\n')}\n`;
}

/**
 * Reads the input file, writes one markdown file per recipe and an index.md.
 */
async function run(inputPath, outDir = 'recipes') {
  const resolvedInput = path.resolve(inputPath);
  const resolvedOut = path.resolve(outDir);

  const text = await readFile(resolvedInput, 'utf8');
  const recipes = convert(text);

  await mkdir(resolvedOut, { recursive: true });

  for (const { title, fileName, markdown } of recipes) {
    await writeFile(path.join(resolvedOut, fileName), markdown, 'utf8');
    console.log(`✔ ${title} -> ${path.join(outDir, fileName)}`);
  }

  await writeFile(path.join(resolvedOut, 'index.md'), toIndexMarkdown(recipes), 'utf8');
  console.log(`✔ Index -> ${path.join(outDir, 'index.md')}`);

  console.log(`\nConverted ${recipes.length} recipe(s).`);
}

export default run;