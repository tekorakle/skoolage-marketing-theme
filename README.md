# astro-marketing-theme

Astro marketing theme. Sidebar nav, services, contact, about, projects, blog aggregator, with a financial business as placeholder. 

All of the site's content resides in JSON files. Edit them, run a build command, and your finished static site lands in `./output/` ready on github pages, gitlab pages, upload anywhere.


---

## Is This Theme For You?

| Feature | Details |
|---|---|
| **Sidebar layout** | Persistent nav sidebar — nested dropdowns, social links, quick-access external sites |
| **Pages** | Home, About, Blog, Services (sub-pages), Portfolio, Contact, Privacy, Terms, 404 |
| **Blog importer** | Fetches an external RSS feed + sitemap at build time — no CMS, no client-side requests |
| **Quick Contact** | Two-step topic-selector form via Web3Forms — no backend |
| **Chat widget** | Simulated live-chat on the homepage — fully static, zero third-party scripts |
| **Featured slider** | Auto-populated hero image carousel from `projects.json` entries |
| **Asset downloader** | `scripts/download-assets.mjs` fetches icons and static files from CDNs before every build — browser never hits a CDN |
| **GitHub images** | Pulls first README image per project repo at build time; cached in `github-image-cache.json` |
| **Dark / Light mode** | Defaults dark; user toggle saved to `localStorage` |
| **Stack** | Astro 6, Tailwind CSS 4, TypeScript, pnpm 11 |
| **Build** | Docker multi-stage: lint → typecheck → build → `./output/`; or run pnpm directly |
| **Requirements** | Docker + Docker Compose, or Node 22+ with pnpm 11 |

---


![Astro Marketing Theme with Sidebar Nav](https://raw.githubusercontent.com/MarcusHoltz/marcusholtz.github.io/refs/heads/main/assets/img/posts/astro-marketing-theme-with-sidebar-nav-services-blog-portfolio-contact.jpg "Astro Marketing Theme for Financial Company")

[Click to view a preview of the theme](#preview-of-theme)



---

## Quick Start

### Docker (recommended)

```bash
docker compose build && docker compose up
# output lands in ./output/ — point any web server at it
```

### Without Docker

```bash
pnpm install
pnpm run dev      # dev server → http://localhost:4321
pnpm run build    # static output → ./dist/
```

---

## Configuration

### `docker-compose.yml` — environment variables

| Variable | Required | Value |
|---|---|---|
| `SITE_URL` | Yes | Full canonical URL — `https://yourdomain.com` |
| `BASE_PATH` | Yes | `/` unless deployed to a subdirectory |
| `GITHUB_USER` | No | GitHub username — enables README image fetching |
| `GITHUB_TOKEN` | No | Token for GitHub API (60 req/hr without; 5,000/hr with) |

The GitHub token is mounted via Docker Secrets — never baked into the image:

```bash
mkdir secrets
echo "ghp_xxxx" > secrets/github_token_password.txt
```

---

## Content Files

All content lives in `src/data/`. No code changes needed to customize any section.

| File | Controls |
|---|---|
| `global/site.json` | Site name, legal name, URL, contact email, Web3Forms key, service types |
| `global/personal.json` | Team/contact info, LinkedIn, social links, about bio |
| `global/navigation.json` | Sidebar nav items (nested), footer links, social label, other-sites list |
| `home/hero.json` | Hero eyebrow, heading, blurb, CTA buttons |
| `home/transaction-desk.json` | Chat widget copy, deal pipeline stats, sector list |
| `home/portal.json` | Client portal card and quick stats |
| `services/services.json` | Service cards (slug, title, highlights, theme colors, page meta, capabilities) |
| `services/services-index.json` | Services index page intro copy |
| `projects/projects.json` | Portfolio company cards (title, category, tags, images, GitHub repo) |
| `projects/projects-page.json` | Projects page intro copy |
| `projects/testimonials.json` | Testimonial entries on the projects page |
| `about/about.json` | About page paragraphs, contact bar, pillar cards |
| `contact/contact.json` | Full contact page copy and form labels |
| `contact/quickhelp.json` | Quick Contact widget — topic list, form labels, success messages |
| `contact/contact-ctas.json` | Contact CTA cards shown across the site |
| `blog/blog-post-cache.json` | Auto-populated at build time — do not edit |
| `projects/github-image-cache.json` | Auto-populated at build time — do not edit |


## Writing Blog Posts

`src/content/posts/` contains the markdown files that will become your blog posts:

- The markdown files in this folder will be rendered as blog posts during build time
- These markdown files require frontmatter added to them, as a metadata for the website
- You will find the following example blog post in the posts directory: `mmmm-cake.md`

```markdown
---
title: "Mmmm Cake"
pubDate: 2026-05-12
description: "Mmmm cake. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mmmm. Cake."
tags: [cake, mmmm, lorem, ipsum]
category: general
draft: false
pin: true
image:
  path: /images/blog/placeholder-cake.jpg
  alt: A delicious raspberry cake, mmmm
---
```

> Use the following link for more information on [using frontmatter in markdown](https://www.markdownlang.com/advanced/frontmatter.html).


---

## Blog Importer

`src/lib/fetchBlog.ts` runs at build time and pulls posts from an external blog:

1. Parses `feed.xml` (RSS from [Jekyll](https://github.com/jekyll/jekyll-feed)) for the most-recent posts and richest metadata.
2. Parses `sitemap.xml` to discover every post URL ever published.
3. Scrapes any URL not in the feed (Open Graph, `article:tag`, JSON-LD).
4. Merges and sorts newest-first; concurrency capped at 6 simultaneous requests.

Set `blog_url` in `personal.json` to point at your blog's domain. Results are cached in `blog-post-cache.json` and reused on subsequent builds until the feed changes.

---

## Asset Downloader

`scripts/download-assets.mjs` runs automatically via `predev` and `prebuild` hooks. It:

- Downloads icons referenced in `projects.json` from Iconify / jsdelivr CDNs.
- Downloads any external scripts listed in `EXTERNAL_SCRIPTS` to `public/scripts/` — browser requests assets only from your own domain.
- Fetches the first non-badge image from each project's GitHub README (requires `GITHUB_USER`).
- Skips files that already exist on disk — safe to re-run, never overwrites custom assets.

---

## Adding a Service Page

1. Add an entry to `src/data/services/services.json` with a unique `slug`.
2. Create `src/pages/services/your-slug.astro` — copy an existing service page and update the data import.
3. Add the route to `global/navigation.json` under the Services `children` array.

---

## Build Pipeline

The Dockerfile runs quality checks as separate stages before the final build. Any failure halts the pipeline.

| Stage | What it does |
|---|---|
| `deps` | `pnpm install --no-frozen-lockfile` |
| `lint` | ESLint — must pass before proceeding |
| `typecheck` | `astro check` — TypeScript strict mode |
| `builder` | `astro build` — output written to `./output/` via volume mount |
| `server` | Optional: bakes `dist/` into an nginx Alpine image and serves on port 80 |

Run the optional nginx server:

```bash
docker compose --profile serve build && docker compose --profile serve up -d
```

---

## Deploying

CI/CD workflows for GitHub Pages, GitLab Pages, and Gitea/Forgejo are included. Push triggers are **commented out** by default — nothing fires until you're ready.

### GitHub Pages

**1. Enable Pages in your repo**

**Settings → Pages → Build and deployment** → set Source to **GitHub Actions**.

**2. Set repository variables**

**Settings → Secrets and variables → Actions → Variables** — add:

| Variable | Required | Value |
|---|---|---|
| `GITHUB_USER` | Yes | Your GitHub username (enables project image fetching) |
| `SITE_URL` | No | Override auto-detected URL — e.g. `https://yourcustomdomain.com` |
| `BASE_PATH` | No | Override auto-detected base path — e.g. `/` after adding a custom domain |

> `BASE_PATH` and `SITE_URL` are auto-detected from `GITHUB_REPOSITORY`. A project repo (`user/my-repo`) gets base `/my-repo/`; a user/org repo (`user/user.github.io`) gets `/`.  Override only when using a custom domain.

**3. Trigger the first deploy**

**Actions → Deploy to GitHub Pages → Run workflow** (top-right) → **Run workflow**.

**4. Watch it go**

Green checkmark → site is live. Click the **Deploy** job for the URL. Red X → re-check that Pages Source is set to **GitHub Actions** in step 1.

**5. Enable automatic deploys**

Uncomment `push: branches: [main]` in `.github/workflows/deploy.yml`. Every future push to `main` rebuilds and redeploys.

**6. Custom domain & DNS**

**Settings → Pages → Custom domain** — enter your domain. At your DNS provider:

```
# Apex domain — all four A records
A    @    185.199.108.153
A    @    185.199.109.153
A    @    185.199.110.153
A    @    185.199.111.153

# www subdomain
CNAME    www    yourusername.github.io.
```

Update `SITE_URL` to `https://yourname.com` and `BASE_PATH` to `/` in repo variables, then push to redeploy.

---

### GitLab Pages

Add CI/CD variables: `GITHUB_USER`, `GITHUB_TOKEN`, and optionally `SITE_URL` / `BASE_PATH`. Run manually via **CI/CD → Pipelines → Run pipeline**, then click the play button on the `pages` job. To enable auto-deploy: uncomment `only: - main` and remove `when: manual` in `.gitlab-ci.yml`.

---

### Self-Hosted / VPS

```bash
docker compose build && docker compose up
rsync -avz ./output/ user@yourserver:/var/www/html/
```

---

### Cloudflare Pages / Netlify / Vercel

Connect your repo, set framework to **Astro**, build command `pnpm run build`, output directory `dist`. Add `SITE_URL`, `BASE_PATH=/`, `GITHUB_USER`, and `GITHUB_TOKEN` as environment variables. All three platforms auto-deploy on push to `main`.

> **Vercel note:** Vercel automatically injects `VERCEL_URL` (the deployment hostname, e.g. `your-project-abc123.vercel.app`) into every build. The Astro config uses this as a fallback so the Font API can construct valid URLs when `SITE_URL` is not explicitly set. No action needed — but if builds fail with `TypeError: Invalid URL`, confirm `SITE_URL` is configured in your Vercel project's environment variables.

---

## Dark Mode

Defaults dark regardless of OS preference. User toggle saves to `localStorage` under `site-theme`.

To restore OS/browser-controlled theming, edit the before-paint script in `src/layouts/Layout.astro`:

```js
var saved = localStorage.getItem("site-theme");
var systemLight = window.matchMedia("(prefers-color-scheme: light)").matches;
if (saved === "light" || (!saved && systemLight)) {
  document.documentElement.classList.add("light-mode");
}
```

Apply the same change to the `astro:after-swap` handler below it.

---

## Sub-Path Deployment

```bash
SITE_URL=https://staging.example.com BASE_PATH=/demo docker compose up
```

Or permanently in `docker-compose.yml`:

```yaml
environment:
  - SITE_URL=https://staging.example.com
  - BASE_PATH=/demo
```

Hard-coded `href="/"` strings in components won't rewrite automatically. Prefix them with `import.meta.env.BASE_URL` for full sub-path support. Production at `/` requires no changes.

---

## Supply Chain Security

This project uses **pnpm 11** with five controls that block the attack patterns behind the 2025–2026 npm supply chain incidents (`chalk`, `debug`, `axios`, the Shai-Hulud worm).

| Threat | Defense |
|---|---|
| Malicious `postinstall` scripts | `strictDepBuilds` — all install scripts blocked unless listed in `allowBuilds` |
| Git/tarball dep injection via transitive deps | `blockExoticSubdeps` — exotic source URLs rejected at resolution time |
| Same-day poisoned releases | `minimumReleaseAge: 10080` — 7-day hold on any version before pnpm resolves it |
| Compromised maintainer account re-publishing | `trustPolicy: no-downgrade` — fails if OIDC provenance publisher has changed |
| Stale or tampered `node_modules` | `verifyDepsBeforeRun` — checks lockfile integrity before every `pnpm run` |

All five controls are always on — they run on every `pnpm install`, including every Docker build.

### Weekly maintenance

```bash
# Update lockfile only (recommended — review before installing)
./update-pinned-packages.sh --lock-only

# Update, install, and clean up node_modules
./update-pinned-packages.sh --discard

# Update and keep node_modules on the host
./update-pinned-packages.sh --install
```

The script runs `pnpm update` → age report → `pnpm audit` in sequence and stops on any failure. Commit `pnpm-lock.yaml` and `package.json` when it finishes green.

### When a new package blocks the install

If `pnpm install` fails with `[ERR_PNPM_IGNORED_BUILDS]`, the package has an install script that hasn't been reviewed:

1. Check what the script does — it should download a platform binary or compile a native addon.
2. Run `pnpm approve-builds` to review it interactively.
3. Add to `allowBuilds` in `pnpm-workspace.yaml` with a comment and date.

Never set `dangerouslyAllowAllBuilds: true`.

### When a security patch is held by the age window

Add the specific version to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`:

```yaml
minimumReleaseAgeExclude:
  - "package-name@x.y.z"  # patches GHSA-xxxx. Remove after 7 days.
```

### Relevant files

| File | Purpose |
|---|---|
| `pnpm-workspace.yaml` | All five security controls — edit to approve builds, add overrides, exempt versions, ignore advisories |
| `pnpm-lock.yaml` | Frozen dependency tree with integrity hashes — commit every change |
| `update-pinned-packages.sh` | Weekly update + audit script |
| `Dockerfile` | Runs `pnpm install --frozen-lockfile` — fails if lockfile is out of sync |

---

## OWASP ASVS Compliance

Statically generated — no server, no user accounts, no sessions, no database. OWASP ASVS Level 1 applicable controls:

| Control | Category | Status | Notes |
|---|---|---|---|
| V2.1 | Authentication | N/A | No user accounts |
| V3.1 | Session Management | N/A | No sessions — stateless static output |
| V4.1 | Access Control | N/A | All content public by design |
| V5.1 | Input Validation | ✅ | No user-supplied parameters reach any query or command |
| V5.3 | Output Encoding | ✅ | Astro auto-escapes HTML; `set:html` flagged by ESLint |
| V7.1 | Error Handling | ✅ | No server-side stack traces exposed |
| V9.1 | Communication Security | ⚠ | HTTPS enforced at CDN/web server layer — all documented deploy targets (GitHub Pages, GitLab Pages, Cloudflare, Netlify, Vercel) enforce TLS by default; self-hosted must configure this at the web server |
| V14.4 | HTTP Security Headers | ⚠ | Must be set at CDN/web server level — not in static output |

**Reference:** [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)


---

## Preview of Theme

![Astro Marketing Theme - Hero Section](https://raw.githubusercontent.com/MarcusHoltz/marcusholtz.github.io/refs/heads/main/assets/img/posts/astro-marketing-theme-0-homepage.png "Brand your new website anyway you like")


![Astro Marketing Theme - Featured Slider Section](https://raw.githubusercontent.com/MarcusHoltz/marcusholtz.github.io/refs/heads/main/assets/img/posts/astro-marketing-theme-1-featured-slider.png "What projects do you want to highlight")


![Astro Marketing Theme - About Section](https://raw.githubusercontent.com/MarcusHoltz/marcusholtz.github.io/refs/heads/main/assets/img/posts/astro-marketing-theme-2-about-us.png "Put your top details and info blurb here")


![Astro Marketing Theme - Services Section](https://raw.githubusercontent.com/MarcusHoltz/marcusholtz.github.io/refs/heads/main/assets/img/posts/astro-marketing-theme-3-services.png "What services do you want to highlight")


![Astro Marketing Theme - Chat Contact Section](https://raw.githubusercontent.com/MarcusHoltz/marcusholtz.github.io/refs/heads/main/assets/img/posts/astro-marketing-theme-4-fake-chat-bot.png "Chats are randomly chosen during build")


![Astro Marketing Theme - Featured Projects Section](https://raw.githubusercontent.com/MarcusHoltz/marcusholtz.github.io/refs/heads/main/assets/img/posts/astro-marketing-theme-5-featured-projects.png "View more featured projects")


![Astro Marketing Theme - Quick Connect Section](https://raw.githubusercontent.com/MarcusHoltz/marcusholtz.github.io/refs/heads/main/assets/img/posts/astro-marketing-theme-6-quick-connect.png "Let the user pick their problem and contact them back")


![Astro Marketing Theme - Footer Section](https://raw.githubusercontent.com/MarcusHoltz/marcusholtz.github.io/refs/heads/main/assets/img/posts/astro-marketing-theme-7-footer.png "Classic Footer")


![Astro Marketing Theme - Light Mode Footer](https://raw.githubusercontent.com/MarcusHoltz/marcusholtz.github.io/refs/heads/main/assets/img/posts/astro-marketing-theme-8-lightmode.png "I am sorry if I hurt your eyes")


![Astro Marketing Theme - Sidebar Collaposed](https://raw.githubusercontent.com/MarcusHoltz/marcusholtz.github.io/refs/heads/main/assets/img/posts/astro-marketing-theme-9-sidebar-collapsed.png "Collapse the sidebar for maximum free screen real estate")



<!-- packages-last-updated: 2026-05-20 -->
