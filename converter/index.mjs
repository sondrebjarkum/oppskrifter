import { parseArgs } from 'node:util';
import run from './md-converter.mjs';

const { values } = parseArgs({
  options: {
    path: { type: 'string', short: 'p' },
    out: { type: 'string', short: 'o', default: 'recipes' },
  },
});

if (!values.path) {
  console.error('Usage: node index.mjs -p <path to file> [-o <output dir>]');
  process.exit(1);
}

try {
  await run(values.path, values.out);
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}