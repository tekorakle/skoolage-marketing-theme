import { mkdir, readFile, writeFile } from 'node:fs/promises';
import Parser from 'rss-parser';
import personalData from '@/data/global/personal.json';

export interface BlogPost {
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  date: string;
  readTime: string;
  link: string;
  slug: string;
  image: string | null;
  accent: string;
  border: string;
}

type FeedItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  contentSnippet?: string;
  'content:encoded'?: string;
  enclosure?: { url?: string };
  mediaContent?: { $?: { url?: string } };
  mediaThumbnail?: { $?: { url?: string } };
  categories?: string[];
  summary?: string;
};

const BLOG_ORIGIN = personalData.blog_url;
const FEED_URL    = `${BLOG_ORIGIN}/feed.xml`;
const SITEMAP_URL = `${BLOG_ORIGIN}/sitemap.xml`;

const CONCURRENCY = 6;

// ─── Category map ─────────────────────────────────────────────────────────────
// Single source of truth: accent colour, Tailwind border class, and display label.
// Lookup falls back to `default` for unknown keys.

const categories: Record<string, { accent: string; border: string; label: string }> = {
  // ── Top-level ─────────────────────────────────────────────────────────────
  linux:               { accent: 'text-emerald-400',  border: 'border-emerald-500/20', label: 'Linux' },
  networking:          { accent: 'text-violet-400',   border: 'border-violet-500/20',  label: 'Networking' },
  proxmox:             { accent: 'text-amber-400',    border: 'border-amber-500/20',   label: 'Proxmox' },
  browsers:            { accent: 'text-indigo-400',   border: 'border-indigo-500/20',  label: 'Browsers' },
  script:              { accent: 'text-lime-400',     border: 'border-lime-500/20',    label: 'Script' },
  wordpress:           { accent: 'text-blue-400',     border: 'border-blue-500/20',    label: 'WordPress' },
  // ── DevOps sub-categories ─────────────────────────────────────────────────
  automation:          { accent: 'text-cyan-400',     border: 'border-cyan-500/20',    label: 'Automation' },
  authentication:      { accent: 'text-pink-400',     border: 'border-pink-500/20',    label: 'Authentication' },
  email:               { accent: 'text-rose-400',     border: 'border-rose-500/20',    label: 'Email' },
  monitoring:          { accent: 'text-orange-400',   border: 'border-orange-500/20',  label: 'Monitoring' },
  reverseproxy:        { accent: 'text-fuchsia-400',  border: 'border-fuchsia-500/20', label: 'Reverse Proxy' },
  support:             { accent: 'text-sky-400',      border: 'border-sky-500/20',     label: 'Support' },
  telemetry:           { accent: 'text-teal-300',     border: 'border-teal-400/20',    label: 'Telemetry' },
  tor:                 { accent: 'text-purple-300',   border: 'border-purple-400/20',  label: 'Tor' },
  waf:                 { accent: 'text-red-300',      border: 'border-red-400/20',     label: 'WAF' },
  docker:              { accent: 'text-orange-400',   border: 'border-orange-500/20',  label: 'Docker' },
  // ── Linux sub-categories ──────────────────────────────────────────────────
  security:            { accent: 'text-red-400',      border: 'border-red-500/20',     label: 'Security' },
  install:             { accent: 'text-green-400',    border: 'border-green-500/20',   label: 'Install' },
  localrepository:     { accent: 'text-emerald-300',  border: 'border-emerald-400/20', label: 'Local Repository' },
  storage:             { accent: 'text-yellow-300',   border: 'border-yellow-400/20',  label: 'Storage' },
  // ── Networking sub-categories ─────────────────────────────────────────────
  dns:                 { accent: 'text-yellow-400',   border: 'border-yellow-500/20',  label: 'DNS' },
  http:                { accent: 'text-blue-300',     border: 'border-blue-400/20',    label: 'HTTP' },
  router:              { accent: 'text-violet-300',   border: 'border-violet-400/20',  label: 'Router' },
  unraid:              { accent: 'text-orange-300',   border: 'border-orange-400/20',  label: 'UnRAID' },
  vpn:                 { accent: 'text-green-300',    border: 'border-green-400/20',   label: 'VPN' },
  wifi:                { accent: 'text-sky-300',      border: 'border-sky-400/20',     label: 'WiFi' },
  // ── Proxmox sub-categories ────────────────────────────────────────────────
  proxmoxbackupserver: { accent: 'text-amber-300',    border: 'border-amber-400/20',   label: 'Backup Server' },
  proxmoxinstall:      { accent: 'text-amber-200',    border: 'border-amber-300/20',   label: 'Install' },
  proxmoxnetworking:   { accent: 'text-violet-300',   border: 'border-violet-400/20',  label: 'Networking' },
  proxmoxstorage:      { accent: 'text-yellow-300',   border: 'border-yellow-400/20',  label: 'Storage' },
  // ── Browser sub-categories ────────────────────────────────────────────────
  privacy:             { accent: 'text-purple-400',   border: 'border-purple-500/20',  label: 'Privacy' },
  sidebery:            { accent: 'text-indigo-300',   border: 'border-indigo-400/20',  label: 'Sidebery' },
  // ── Script sub-categories ─────────────────────────────────────────────────
  files:               { accent: 'text-lime-300',     border: 'border-lime-400/20',    label: 'Files' },
  // ── Fallback ──────────────────────────────────────────────────────────────
  default:             { accent: 'text-electric-cyan', border: 'border-cyan-500/20',   label: '' },
};

function getCategoryLabel(key: string): string {
  return categories[key]?.label || key;
}

function getCategoryStyles(key: string): { accent: string; border: string } {
  const { accent, border } = categories[key] ?? categories.default;
  return { accent, border };
}

function getBestCategory(tags: string[], slug = ''): string {
  const knownCats = Object.keys(categories).filter((k) => k !== 'default');
  const byLength = [...knownCats].sort((a, b) => b.length - a.length);

  for (const tag of tags) {
    const lower = tag.toLowerCase().trim();
    if (knownCats.includes(lower)) return lower;
  }
  for (const tag of tags) {
    const lower = tag.toLowerCase().trim();
    for (const cat of byLength) {
      if (lower.includes(cat)) return cat;
    }
  }
  if (tags[0]) return tags[0].toLowerCase().trim();
  const slugLower = slug.toLowerCase();
  for (const cat of byLength) {
    if (slugLower.includes(cat)) return cat;
  }
  return 'general';
}

// ─── Build cache ──────────────────────────────────────────────────────────────
// Avoids re-fetching the RSS feed + scraping every post on every build.
// The cache file is committed alongside the source; any build that hits the
// network updates it so subsequent builds in the same CI run are instant.

interface BlogCache {
  posts: BlogPost[];
  cachedAt: string;
}

const blogCachePath = new URL('../data/blog/blog-post-cache.json', import.meta.url);
const BLOG_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function loadBlogCache(): Promise<BlogCache | null> {
  try {
    const raw = await readFile(blogCachePath, 'utf-8');
    return JSON.parse(raw) as BlogCache;
  } catch {
    return null;
  }
}

async function saveBlogCache(posts: BlogPost[]): Promise<void> {
  try {
    await mkdir(new URL('.', blogCachePath), { recursive: true });
    const cache: BlogCache = { posts, cachedAt: new Date().toISOString() };
    await writeFile(blogCachePath, JSON.stringify(cache, null, 2) + '\n', 'utf-8');
  } catch (err) {
    console.warn('[fetchBlog] Could not write cache:', (err as Error).message);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractImage(item: FeedItem): string | null {
  const thumb = item.mediaThumbnail?.['$']?.url;
  if (thumb) return thumb;
  const media = item.mediaContent?.['$']?.url;
  if (media) return media;
  if (item.enclosure?.url) return item.enclosure.url;
  const content = item['content:encoded'] ?? '';
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1]) return imgMatch[1];
  return null;
}

/**
 * Counts prose words only — code blocks (<pre>, <code>) are stripped first so
 * that command-heavy DevOps posts don't produce wildly inflated read times.
 */
function countProseWords(html: string): number {
  const noCode = html.replace(/<(pre|code)[^>]*>[\s\S]*?<\/(pre|code)>/gi, ' ');
  const noTags = noCode.replace(/<[^>]+>/g, ' ');
  return noTags.split(/\s+/).filter(Boolean).length;
}

function estimateReadTime(item: FeedItem): string {
  const raw     = item['content:encoded'] ?? item.contentSnippet ?? '';
  const words   = countProseWords(raw);
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

function extractSlug(url: string): string {
  return url.replace(/\/$/, '').split('/').pop() ?? url;
}

function formatDate(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toISOString().slice(0, 10);
}

function buildExcerpt(source: string): string {
  if (!source) return '';
  const trimmed = source.slice(0, 220).trimEnd();
  return trimmed + '…';
}

function feedItemToPost(item: FeedItem, atomTags?: string[]): BlogPost {
  const tags     = (atomTags && atomTags.length > 0) ? atomTags : (item.categories ?? []);
  const slug     = extractSlug(item.link ?? '');
  const catKey   = getBestCategory(tags, slug);
  const category = getCategoryLabel(catKey);
  const styles   = getCategoryStyles(catKey);
  const excerptSource = item.summary || item.contentSnippet || '';

  return {
    title:    item.title ?? 'Untitled',
    excerpt:  buildExcerpt(excerptSource),
    category,
    tags,
    date:     formatDate(item.isoDate ?? item.pubDate ?? ''),
    readTime: estimateReadTime(item),
    link:     item.link ?? '#',
    slug:     extractSlug(item.link ?? ''),
    image:    extractImage(item),
    accent:   styles.accent,
    border:   styles.border,
  };
}

// ─── Atom category extraction ─────────────────────────────────────────────────

async function fetchAtomCategories(): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  try {
    const res = await fetch(FEED_URL, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return map;
    const xml = await res.text();
    const entries = [...xml.matchAll(/<entry[\s>]([\s\S]*?)<\/entry>/gi)];
    for (const [, body] of entries) {
      const linkMatch =
        body.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i) ??
        body.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']alternate["']/i);
      if (!linkMatch) continue;
      const terms = [...body.matchAll(/<category[^>]+term=["']([^"']+)["']/gi)]
        .map((m) => m[1].trim()).filter(Boolean);
      if (terms.length > 0) map.set(linkMatch[1].trim(), terms);
    }
  } catch { /* non-fatal */ }
  return map;
}

// ─── Sitemap discovery ────────────────────────────────────────────────────────

async function fetchSitemapPostUrls(): Promise<string[]> {
  try {
    const res = await fetch(SITEMAP_URL, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const matches = [...xml.matchAll(/<loc>(https?:\/\/[^<]*\/posts\/[^<]+)<\/loc>/gi)];
    return matches.map((m) => m[1].trim());
  } catch {
    return [];
  }
}

// ─── Per-page meta scraping ───────────────────────────────────────────────────

async function scrapePostMeta(url: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const html = await res.text();

    const og  = (prop: string) => html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]+)"`, 'i'))?.[1]
                                ?? html.match(new RegExp(`<meta[^>]+content="([^"]+)"[^>]+property="${prop}"`, 'i'))?.[1]
                                ?? '';
    const meta = (name: string) => html.match(new RegExp(`<meta[^>]+name="${name}"[^>]+content="([^"]+)"`, 'i'))?.[1]
                                ?? html.match(new RegExp(`<meta[^>]+content="([^"]+)"[^>]+name="${name}"`, 'i'))?.[1]
                                ?? '';

    const title    = og('og:title') || html.match(/<title>([^<]+)<\/title>/i)?.[1]?.replace(/\s*[|–—-].*$/, '').trim() || 'Untitled';
    const excerpt  = og('og:description') || meta('description') || '';
    const image    = og('og:image') || null;
    const rawDate  = og('article:published_time') || meta('date') || html.match(/<time[^>]+datetime="([^"]+)"/i)?.[1] || '';

    const tagMatches = [
      ...html.matchAll(/<meta[^>]+property="article:tag"[^>]+content="([^"]+)"/gi),
      ...html.matchAll(/<meta[^>]+content="([^"]+)"[^>]+property="article:tag"/gi),
    ];
    const tags = [...new Set(tagMatches.map((m) => m[1]).filter(Boolean))];

    if (tags.length === 0) {
      const ldMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
      if (ldMatch) {
        try {
          const ld = JSON.parse(ldMatch[1]);
          const kw: unknown = ld.keywords ?? ld.about;
          if (typeof kw === 'string') tags.push(...kw.split(',').map((s: string) => s.trim()).filter(Boolean));
          else if (Array.isArray(kw)) tags.push(...(kw as string[]).filter((s) => typeof s === 'string'));
        } catch { /* ignore malformed JSON-LD */ }
      }
    }

    const slug     = extractSlug(url);
    const catKey   = getBestCategory(tags, slug);
    const category = getCategoryLabel(catKey);
    const styles   = getCategoryStyles(catKey);

    const bodyMatch = html.match(/<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i);
    const bodyHtml  = bodyMatch ? bodyMatch[1] : html;
    const words     = countProseWords(bodyHtml);
    const minutes   = Math.max(1, Math.round(words / 200));

    return {
      title,
      excerpt:  buildExcerpt(excerpt),
      category,
      tags,
      date:     formatDate(rawDate),
      readTime: `${minutes} min read`,
      link:     url,
      slug:     extractSlug(url),
      image,
      accent:   styles.accent,
      border:   styles.border,
    };
  } catch {
    return null;
  }
}

async function withConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function fetchBlogPosts(): Promise<BlogPost[]> {
  const cache = await loadBlogCache();
  if (cache) {
    const ageMs = Date.now() - new Date(cache.cachedAt).getTime();
    if (ageMs < BLOG_CACHE_TTL_MS && cache.posts.length > 0) {
      return cache.posts;
    }
  }

  try {
    const parser = new Parser<Record<string, unknown>, FeedItem>({
      timeout: 15_000,
      customFields: {
        item: [
          ['media:content',   'mediaContent',   { keepArray: false }],
          ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
        ],
      },
    });

    const [feed, sitemapUrls, atomCatMap] = await Promise.all([
      parser.parseURL(FEED_URL),
      fetchSitemapPostUrls(),
      fetchAtomCategories(),
    ]);

    const feedPosts  = feed.items.map((item) =>
      feedItemToPost(item, item.link ? atomCatMap.get(item.link) : undefined)
    );
    const feedBySlug = new Map(feedPosts.map((p) => [p.slug, p]));

    const missingUrls = sitemapUrls.filter((url) => !feedBySlug.has(extractSlug(url)));
    const imagelessFeedPosts = feedPosts.filter((p) => !p.image && p.link && p.link !== '#');

    const scrapeUrls = [...missingUrls, ...imagelessFeedPosts.map((p) => p.link)];
    const scrapedBySlug = new Map<string, BlogPost>();
    if (scrapeUrls.length > 0) {
      const tasks = scrapeUrls.map((url) => () => scrapePostMeta(url));
      const results = await withConcurrency(tasks, CONCURRENCY);
      for (const p of results) {
        if (p) scrapedBySlug.set(p.slug, p);
      }
    }

    const mergedFeedPosts = feedPosts.map((p) => {
      if (p.image) return p;
      const scraped = scrapedBySlug.get(p.slug);
      return scraped?.image ? { ...p, image: scraped.image } : p;
    });

    const scrapedPosts = [...scrapedBySlug.values()].filter((p) => !feedBySlug.has(p.slug));
    const allPosts = [...mergedFeedPosts, ...scrapedPosts];
    allPosts.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

    await saveBlogCache(allPosts);
    return allPosts;
  } catch (err) {
    console.warn('[fetchBlog] Could not fetch blog feed:', (err as Error).message);
    return cache?.posts ?? [];
  }
}
