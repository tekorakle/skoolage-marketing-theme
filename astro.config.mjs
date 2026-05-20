import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';

function injectRobotsSitemap() {
  return {
    name: 'inject-robots-sitemap',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        if (!process.env.SITE_URL) return;
        const { readFile, writeFile } = await import('node:fs/promises');
        const { join } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const robotsPath = join(fileURLToPath(dir), 'robots.txt');
        const siteUrl = process.env.SITE_URL.replace(/^http:\/\//, 'https://').replace(/\/?$/, '');
        const content = await readFile(robotsPath, 'utf-8');
        if (!content.includes('Sitemap:')) {
          await writeFile(robotsPath, `${content.trim()}\nSitemap: ${siteUrl}/sitemap-index.xml\n`);
        }
      },
    },
  };
}

function stripHtmlComments() {
  return {
    name: 'strip-html-comments',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const { readdir, readFile, writeFile } = await import('node:fs/promises');
        const { join } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const distPath = fileURLToPath(dir);
        async function walk(current) {
          const entries = await readdir(current, { withFileTypes: true });
          await Promise.all(entries.map(async (entry) => {
            const full = join(current, entry.name);
            if (entry.isDirectory()) return walk(full);
            if (!entry.name.endsWith('.html')) return;
            const html = await readFile(full, 'utf-8');
            await writeFile(full, html.replace(/<!--(?!!)([\s\S]*?)-->/g, ''));
          }));
        }
        await walk(distPath);
      },
    },
  };
}

// base: './' is broken in Astro 6: prependForwardSlash() in vite-plugin-assets.ts
// always prepends '/', turning './' into '/.' and making BASE_URL = '/.'.
// Root-relative paths (/images/...) with build.format:'file' (flat dist/) work
// from any server root without setting BASE_PATH.
// Docs: https://docs.astro.build/en/reference/configuration-reference/#buildformat
//       https://docs.astro.build/en/reference/configuration-reference/#trailingslash

export default defineConfig({
  // Force https:// so Astro-generated absolute URLs (prefetch hints, sitemaps,
  // canonical tags) are never HTTP — even when SITE_URL is set as http://.
  // VERCEL_URL is injected automatically by Vercel on every deployment and lets
  // the Font API (which requires an absolute site URL) work even when SITE_URL
  // is not explicitly configured.
  site: process.env.SITE_URL?.replace(/^http:\/\//, 'https://')
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'never',
  output: 'static',
  compressHTML: true,
  // 'attribute' scopes component styles via data-astro-* attributes instead of mangled class names,
  // which is more predictable when targeting elements from global CSS or JavaScript.
  scopedStyleStrategy: 'attribute',
  integrations: [
    ...(process.env.SITE_URL ? [sitemap()] : []),
    injectRobotsSitemap(),
    stripHtmlComments(),
  ],
  // Global font downloads via Astro Fonts API — self-hosted at build time,
  // eliminating Google Fonts CDN requests at runtime.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Inter',
      cssVariable: '--font-inter',
    },
    {
      provider: fontProviders.google(),
      name: 'Oswald',
      cssVariable: '--font-oswald',
      weights: [400, 700],
    },
  ],
  // Global Sharp codec defaults for all processed images.
  // Per-image `quality` props still override these.
  image: {
    remotePatterns: [
      { hostname: 'raw.githubusercontent.com' },
      { hostname: 'user-images.githubusercontent.com' },
      { hostname: 'camo.githubusercontent.com' },
    ],
    service: {
      config: {
        jpeg: { mozjpeg: true },
        webp: { effort: 4 },
        avif: { effort: 4, chromaSubsampling: '4:2:0' },
      },
    },
  },
});
