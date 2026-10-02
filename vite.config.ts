import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  publicDir: 'public-site/assets',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: {
      strict: true,
      allow: [process.cwd()],
      deny: ['.env', '.env.*', '*.{crt,pem,key}', '**/.git/**', '**/.runtime/**', '**/.vercel/**', '**/.pnpm-store/**', '**/api/**', '**/backend/**', '**/database/**', '**/scripts/**', '**/tests/**', '**/docs/**'],
    },
    proxy: { '/api': process.env.API_TARGET || 'http://127.0.0.1:4000' },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 700 },
});
