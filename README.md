# Billy Command Center

Public index of Billy’s live sites: URLs, GitHub, created/modified dates, status, and per-project stack notes.

- **Domain:** [billycommandcenter.com](https://billycommandcenter.com) (connect in Cloudflare Pages; this repo does not change DNS)
- **Host:** Cloudflare Pages
- **Stack:** static HTML + CSS generated from `data/projects.json` by a small Node script

Not Astro. HTML is emitted at the **repo root** so Pages can serve the files as-is.

## Layout

| Path | Role |
| --- | --- |
| `data/projects.json` | Source of truth (array of project objects) |
| `scripts/build.mjs` | Reads JSON, writes `index.html` and `projects/<slug>.html` |
| `styles.css` | Shared dark command-center stylesheet |
| `index.html` | Inventory (table on desktop, cards on mobile) |
| `projects/<slug>.html` | Detail page: full stack, notes, links |

**Do not edit the HTML by hand.** Change JSON, then rebuild.

## Project object

```json
{
  "slug": "contactbilly",
  "name": "Contact Billy",
  "url": "https://contactbilly.com",
  "github": "https://github.com/Billyjameshowell/contactbilly",
  "githubPrivate": true,
  "created": "2026-08-19",
  "updated": "2026-08-29",
  "dateSource": "github",
  "stack": ["Astro", "Cloudflare Worker", "GitHub"],
  "status": "shipped",
  "notes": "…",
  "extraLinks": [{ "label": "Preview", "url": "https://example.pages.dev" }]
}
```

- `status`: `shipped` | `dev` | `broken` (badge on index + detail; shipped green, dev amber, broken red)
- `dateSource`: `github` | `http` | `mixed` | `unverified`
- `url` / `github` / `created` / `updated` may be `null` when unknown
- Dates are `YYYY-MM-DD` (UTC calendar day)

**Date policy:** Created / last modified prefer GitHub `created_at` / `pushed_at` when HTTP `Last-Modified` isn’t available. If a host sends `Last-Modified`, that value is used for `updated` and `dateSource` is `http` or `mixed`.

## Edit + build

Needs Node 18+.

```bash
# 1. Edit the inventory
$EDITOR data/projects.json

# 2. Regenerate HTML
node scripts/build.mjs
# or: npm run build
```

The script overwrites `index.html` and every `projects/*.html`. Commit both the JSON and the generated HTML so Pages can deploy even if the build command is skipped.

## Deploy to Cloudflare Pages

1. In Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**
2. Select `Billyjameshowell/billycommandcenter`, production branch `main`
3. Build settings:
   - **Build command:** `node scripts/build.mjs`
   - **Output directory:** `/` (project root — leave empty if the UI requires a blank root)
4. Save and deploy. Optional: attach `billycommandcenter.com` as a custom domain in the Pages project (do this in the dashboard; don’t change DNS from this repo).

Local preview after build: any static server from the repo root, e.g. `python3 -m http.server 4173`.

## FUTURE: refresh Action / cron

Document only — **do not implement the Action yet.**

Ideal next step: a GitHub Action (schedule + `workflow_dispatch`, plus optional `repository_dispatch` from deploy hooks) that:

1. Reads `data/projects.json`
2. For each row with a GitHub URL, calls the GitHub API and writes `created` from `created_at` and a candidate `updated` from `pushed_at`
3. Optionally `HEAD`/`GET` each live URL and, when `Last-Modified` is present, prefer that instant for `updated` (`dateSource`: `http` or `mixed`)
4. Leaves dates `null` / `dateSource: unverified` when neither source exists
5. Runs `node scripts/build.mjs`
6. Commits the JSON + generated HTML (or opens a PR) and lets Cloudflare Pages rebuild from `main`

Notes for that Action:

- Use a fine-scoped token that can read **private** tracked repos (`contactbilly`, `billyzine`, etc.)
- Respect GitHub rate limits; skip junk/templates/sandboxes
- Do not treat `crozettrolley.com` as the Crozet Trolley `dev` project; do not mark that staging preview `broken`
- HTTP `Last-Modified` can be older than `created_at` (see movieRankr); keep the policy in the JSON notes when that happens
