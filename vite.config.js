import { defineConfig } from 'vite';
import { resolve } from 'path';
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup.html"),
        content: resolve(__dirname, "src/content.js" ),
      }
    }
  },
  optimizeDeps: {
    include: ["crypto-js/aes", "crypto-js/enc-utf8"],
  },
  publicDir: 'public'
});
