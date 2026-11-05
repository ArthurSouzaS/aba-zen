// Gera os PNGs do ícone a partir de public/icons/icon.svg usando o Chromium do Playwright.
// Uso: npm run icons  (requer o pacote `playwright` instalado, local ou globalmente)
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

// `require` respeita NODE_PATH, então funciona com um Playwright instalado globalmente.
const { chromium } = createRequire(import.meta.url)('playwright');

const dir = resolve(import.meta.dirname, '../public/icons');
const svg = await readFile(resolve(dir, 'icon.svg'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();

for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path: resolve(dir, `icon-${size}.png`), omitBackground: true });
  console.log(`icon-${size}.png`);
}

await browser.close();
