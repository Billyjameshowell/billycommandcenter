# Billy Command Center

Personal index of Billy’s live sites: links, GitHub, created/modified dates, status, and per-project stack pages.

- **Domain:** billycommandcenter.com
- **Host:** Cloudflare Pages
- **Stack (this site):** static HTML + CSS + `data/projects.json` (Astro later if needed)

## Layout

- `index.html` — project list
- `projects/<slug>.html` — stack detail
- `data/projects.json` — source of truth for the list

## Status

Each project has `status`: `dev` | `shipped` | `broken` (badge on index + detail).

## Future: auto-refresh

Ideal next step: GitHub Action / deploy hooks that refresh `data/projects.json` (repo `created_at` / `pushed_at`, optional HTTP `Last-Modified`, status heuristics) when tracked repos push, then redeploy Pages.

Owned by Static Site Bot; CoS briefed 2026-09-09.
