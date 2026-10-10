// Local-only UI tests. Never used by build:pages or GitHub Actions.
import base from './vite.pages.config';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
  ...base,
  resolve: {
    alias: [
      {
        find: '@/lib/supabase',
        replacement: fileURLToPath(
          new URL('./scripts/fixtures/supabase.ts', import.meta.url),
        ),
      },
      { find: '@', replacement: fileURLToPath(new URL('.', import.meta.url)) },
    ],
  },
});
