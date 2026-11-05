import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { createManifest } from './src/manifest.ts';
import pkg from './package.json' with { type: 'json' };

const src = resolve(import.meta.dirname, 'src');

/** Gera o manifest.json a partir de src/manifest.ts (versão vem do package.json). */
function manifestPlugin(): Plugin {
  return {
    name: 'aba-zen-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: JSON.stringify(createManifest(pkg.version), null, 2),
      });
    },
  };
}

export default defineConfig({
  root: src,
  publicDir: resolve(import.meta.dirname, 'public'),
  base: './',
  plugins: [manifestPlugin()],
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    target: 'chrome120',
    modulePreload: false,
    sourcemap: false,
    rollupOptions: {
      input: {
        newtab: resolve(src, 'newtab/index.html'),
        popup: resolve(src, 'popup/index.html'),
        options: resolve(src, 'options/index.html'),
        blocked: resolve(src, 'blocked/index.html'),
        background: resolve(src, 'background/index.ts'),
      },
      output: {
        // O service worker precisa de um caminho fixo, referenciado no manifest.
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
