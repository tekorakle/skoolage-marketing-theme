/**
 * Downloads any CDN assets that are referenced in src/data/*.json but absent
 * from public/. Run automatically via the prebuild / predev npm hooks.
 *
 * Icon path → CDN URL rules:
 *   /images/icons/devicons/{name}.svg       → jsdelivr devicons (folder derived from name)
 *   /images/icons/materialdesign/{name}.svg → jsdelivr Templarian/MaterialDesign
 *   /images/icons/dashboard-icons/{name}.png → jsdelivr homarr-labs/dashboard-icons
 *
 * Fonts: now handled by Astro's Fonts API (astro.config.mjs) at build time.
 *
 * External scripts: listed in EXTERNAL_SCRIPTS below, downloaded to public/scripts/
 * at build/dev time so the browser only hits our domain at runtime.
 *
 * GitHub project images: reads projects.json for entries with githubRepo set,
 * fetches the first non-badge image from each repo's README, and saves it to
 * the local path specified in featuredImage / backgroundImage in projects.json.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT   = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');

// ─── helpers ────────────────────────────────────────────────────────────────

async function downloadBinary(url, dest) {
  console.log(`  + ${dest.replace(PUBLIC, 'public')}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

/**
 * Derive the devicons subfolder from a filename like "docker-original-wordmark.svg".
 * The folder name is everything before the first variant suffix.
 */
function deviconFolder(filename) {
  return filename
    .replace(/\.svg$/, '')
    .replace(/-(original|plain|line)(-wordmark)?$/, '');
}

function cdnUrlFor(localPath) {
  const file = localPath.replace(/^\/images\/icons\/[^/]+\//, '');
  if (localPath.startsWith('/images/icons/devicons/'))
    return `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${deviconFolder(file)}/${file}`;
  if (localPath.startsWith('/images/icons/materialdesign/'))
    return `https://cdn.jsdelivr.net/gh/Templarian/MaterialDesign/svg/${file}`;
  if (localPath.startsWith('/images/icons/dashboard-icons/'))
    return `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/${file}`;
  return null;
}

// ─── image URL allowlist (build-time SSRF guard) ────────────────────────────

const ALLOWED_IMAGE_HOSTS = new Set([
  'raw.githubusercontent.com',
  'user-images.githubusercontent.com',
  'camo.githubusercontent.com',
  'github.com',
  'cdn.jsdelivr.net',
]);

function isAllowedImageUrl(url) {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_IMAGE_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

// ─── badge detection ────────────────────────────────────────────────────────

const BADGE_DOMAINS = new Set([
  'shields.io',
  'img.shields.io',
  'badgen.net',
  'badge.fury.io',
  'travis-ci.org',
  'travis-ci.com',
  'app.travis-ci.com',
  'circleci.com',
  'dl.circleci.com',
  'codecov.io',
  'coveralls.io',
  'api.codeclimate.com',
  'codebeat.co',
  'app.codacy.com',
  'bettercodehub.com',
  'sonarcloud.io',
  'snyk.io',
  'app.fossa.com',
  'david-dm.org',
  'wakatime.com',
  'forthebadge.com',
  'isitmaintained.com',
  'visitor-badge.glitch.me',
  'hits.seeyoufarm.com',
  'komarev.com',
  'img.buymeacoffee.com',
  'cdn.buymeacoffee.com',
]);

function isBadgeUrl(url) {
  const urlBase = url.split('?')[0];
  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {}
  return (
    BADGE_DOMAINS.has(hostname) ||
    urlBase.includes('badge.svg') ||
    urlBase.includes('/badge/') ||
    urlBase.includes('/badges/') ||
    url.includes('/actions/workflows/') ||
    url.includes('project_badges/') ||
    url.includes('/project/badge/') ||
    (url.includes('github.com/') && urlBase.endsWith('.svg')) ||
    (url.includes('raw.githubusercontent.com/') && urlBase.endsWith('.svg'))
  );
}

function extractImageFromReadme(markdown, repoName, branch, githubUser) {
  const imageRegex = /!\[.*?\]\(([^)]+)\)/g;
  let match;
  while ((match = imageRegex.exec(markdown)) !== null) {
    let url = match[1].trim().split(/\s+/)[0];
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (isBadgeUrl(url)) continue;
      url = url
        .replace('https://github.com/', 'https://raw.githubusercontent.com/')
        .replace(/\/blob\//, '/');
      return url;
    }
    const relative = url.startsWith('/') ? url.slice(1) : url;
    const resolved = `https://raw.githubusercontent.com/${githubUser}/${repoName}/${branch}/${relative}`;
    if (isBadgeUrl(resolved)) continue;
    return resolved;
  }
  return null;
}

// ─── GitHub project images ───────────────────────────────────────────────────

async function ensureProjectImages() {
  const githubUser = process.env.GITHUB_USER;
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubUser) return;

  const dataDir = join(ROOT, 'src', 'data');
  const projectsPath = join(dataDir, 'projects', 'projects.json');
  if (!existsSync(projectsPath)) return;

  const projects = JSON.parse(readFileSync(projectsPath, 'utf8'));
  const githubProjects = projects.filter((p) => p.githubRepo);
  if (githubProjects.length === 0) return;

  const cachePath = join(dataDir, 'projects', 'github-image-cache.json');
  let cache = {};
  try {
    cache = JSON.parse(readFileSync(cachePath, 'utf8'));
  } catch {}

  const authHeaders = {
    'User-Agent': 'apex-capgroup-astro-build',
    ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
  };

  let repos = [];
  try {
    const res = await fetch(
      `https://api.github.com/users/${githubUser}/repos?per_page=100&sort=updated`,
      { headers: authHeaders }
    );
    if (!res.ok) throw new Error(`status ${res.status}`);
    repos = await res.json();
  } catch (err) {
    console.warn(`  ! GitHub API failed (${err.message}) — skipping project image download`);
    return;
  }

  const repoMap = new Map(repos.map((r) => [r.name.toLowerCase(), r]));
  const updatedCache = { ...cache };
  let downloaded = 0;

  for (const project of githubProjects) {
    const repoName = project.githubRepo;
    const repoInfo = repoMap.get(repoName.toLowerCase());
    if (!repoInfo) continue;

    // Unique local /images/projects/ paths for this project that are missing from disk
    const localPaths = [
      ...new Set([project.featuredImage, project.backgroundImage].filter(Boolean)),
    ].filter((p) => p.startsWith('/images/projects/') && !existsSync(join(PUBLIC, p)));

    if (localPaths.length === 0) continue;

    const repoUpdatedAt = repoInfo.updated_at;
    const cached = cache[repoName];
    const cacheHit = cached && cached.repoUpdatedAt === repoUpdatedAt;

    // Reuse the cached remote URL when the repo hasn't changed; otherwise fetch README
    let imageUrl = cacheHit ? cached.image : null;

    if (!imageUrl) {
      try {
        const res = await fetch(`https://api.github.com/repos/${githubUser}/${repoName}/readme`, {
          headers: authHeaders,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.encoding === 'base64') {
            const md = Buffer.from(data.content, 'base64').toString('utf-8');
            imageUrl = extractImageFromReadme(md, repoName, repoInfo.default_branch, githubUser);
          }
        }
      } catch {}
    }

    updatedCache[repoName] = {
      image: imageUrl ?? null,
      localPath: localPaths[0] ?? null,
      repoUpdatedAt,
      fetchedAt: new Date().toISOString(),
    };

    if (!imageUrl) {
      console.warn(`  ! ${repoName}: no image found in README`);
      continue;
    }

    // Download the image once, write it to every missing local path
    let imgData = null;
    for (const localPath of localPaths) {
      const destFile = join(PUBLIC, localPath);
      mkdirSync(dirname(destFile), { recursive: true });
      try {
        if (!imgData) {
          if (!isAllowedImageUrl(imageUrl))
            throw new Error(`blocked: host not in allowlist (${new URL(imageUrl).hostname})`);
          const imgRes = await fetch(imageUrl);
          if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
          imgData = Buffer.from(await imgRes.arrayBuffer());
        }
        writeFileSync(destFile, imgData);
        console.log(`  + public${localPath}`);
        downloaded++;
      } catch (err) {
        console.warn(`  ! ${repoName} → ${localPath}: ${err.message}`);
      }
    }
  }

  try {
    writeFileSync(cachePath, JSON.stringify(updatedCache, null, 2) + '\n');
  } catch {}

  if (downloaded > 0) console.log(`Downloaded ${downloaded} project image(s) from GitHub.`);
}

// ─── icons ──────────────────────────────────────────────────────────────────

async function ensureIcons() {
  const dataDir = join(ROOT, 'src', 'data');
  const referenced = new Set();

  for (const filename of ['projects/projects.json']) {
    const path = join(dataDir, filename);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, 'utf8');
    for (const [, p] of text.matchAll(/"(?:logo|colorIcon)":\s*"(\/images\/icons\/[^"]+)"/g))
      referenced.add(p);
  }

  const missing = [...referenced].filter(p => !existsSync(join(PUBLIC, p)));
  if (missing.length === 0) return;

  console.log(`Downloading ${missing.length} missing icon(s)...`);
  const results = await Promise.allSettled(
    missing.map(p => {
      const url = cdnUrlFor(p);
      if (!url) {
        console.warn(`  ! no CDN mapping for ${p} — skipping`);
        return Promise.resolve();
      }
      return downloadBinary(url, join(PUBLIC, p));
    })
  );
  for (const r of results)
    if (r.status === 'rejected') console.warn(`  ! ${r.reason.message}`);
}

// ─── external scripts ───────────────────────────────────────────────────────
// Mirrors the Fonts API pattern: download at build/dev time, serve from our domain.
// Paths are relative to public/. URLs must be pinned to a specific version so the
// cached file stays valid until the entry is updated here.

const EXTERNAL_SCRIPTS = [
  {
    url: 'https://cdn.jsdelivr.net/npm/three/build/three.min.js',
    dest: 'scripts/three.min.js',
  },
];

async function ensureScripts() {
  const missing = EXTERNAL_SCRIPTS.filter(({ dest }) => !existsSync(join(PUBLIC, dest)));
  if (missing.length === 0) return;
  console.log(`Downloading ${missing.length} external script(s)...`);
  const results = await Promise.allSettled(
    missing.map(({ url, dest }) => downloadBinary(url, join(PUBLIC, dest)))
  );
  for (const r of results)
    if (r.status === 'rejected') console.warn(`  ! ${r.reason.message}`);
}

// ─── main ───────────────────────────────────────────────────────────────────
// Fonts are now handled by Astro's Fonts API (astro.config.mjs) at build time.

async function main() {
  await ensureProjectImages();
  await ensureIcons();
  await ensureScripts();
  console.log('Assets ready.');
}

main().catch(err => { console.error('download-assets:', err.message); process.exit(1); });
