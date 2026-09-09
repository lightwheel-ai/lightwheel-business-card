import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const repositoryBasePath = '/lightwheel-business-card';

export default defineConfig({
  root: fileURLToPath(new URL('./pages-src', import.meta.url)),
  base: `${repositoryBasePath}/`,
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  define: {
    'process.env.NEXT_PUBLIC_BASE_PATH': JSON.stringify(repositoryBasePath),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('./pages-dist', import.meta.url)),
    emptyOutDir: true,
  },
});
