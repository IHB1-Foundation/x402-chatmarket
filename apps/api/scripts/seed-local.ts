import { seed } from '../src/cli/seed.js';

seed().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Seed failed: ${msg}`);
  process.exit(1);
});

