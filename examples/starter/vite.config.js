import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Mismo objetivo que cualquier app de apuntes: UN único HTML con todo inline
// (JS, CSS y fuentes del SDK en base64), ejecutable por file:// sin red.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    target: 'es2019',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: { polyfill: false },
    rollupOptions: { output: { inlineDynamicImports: true } },
    chunkSizeWarningLimit: 100_000_000
  }
});
