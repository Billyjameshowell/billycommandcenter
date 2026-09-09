#!/usr/bin/env node
/**
 * Generate index.html + projects/<slug>.html from data/projects.json.
 *
 *   node scripts/build.mjs
 *
 * Output is written to the repo root (Cloudflare Pages serves `/`).
 * Future GitHub Actions can refresh dates in the JSON, then re-run this script.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data", "projects.json");
const PROJECTS_DIR = join(ROOT, "projects");
const STATUSES = ["shipped", "dev", "broken"];
const STATUS_RANK = Object.fromEntries(STATUSES.map((s, i) => [s, i]));
const DATE_SOURCE_LABEL = {
  github: "GitHub API",
  http: "HTTP Last-Modified",
  mixed: "GitHub + HTTP Last-Modified",
  unverified: "unverified",
};

const DATE_POLICY =
  "Created / last modified prefer GitHub <code>created_at</code> / <code>pushed_at</code> when HTTP <code>Last-Modified</code> isn’t available.";

function loadProjects() {
  const raw = JSON.parse(readFileSync(DATA, "utf8"));
  if (!Array.isArray(raw)) throw new Error("data/projects.json must be an array");
  for (const p of raw) {
    if (!p.slug || !p.name) throw new Error(`Project missing slug/name: ${JSON.stringify(p)}`);
    if (!STATUSES.includes(p.status)) {
      throw new Error(`Invalid status "${p.status}" on ${p.slug}`);
    }
  }
  return raw;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return esc(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
}

function hostLabel(url) {
  if (!url) return "—";
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function githubLabel(url) {
  if (!url) return null;
  try {
    const { pathname } = new URL(url);
    return pathname.replace(/^\//, "");
  } catch {
    return url;
  }
}

function chips(stack, extraClass = "") {
  if (!stack?.length) return `<span class="muted">—</span>`;
  return stack
    .map((s) => `<span class="chip ${extraClass}">${esc(s)}</span>`)
    .join("");
}

function statusBadge(status) {
  return `<span class="badge badge-${esc(status)}">${esc(status)}</span>`;
}

function sortProjects(projects) {
  return [...projects].sort((a, b) => {
    const sr = (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99);
    if (sr) return sr;
    const au = a.updated || a.created || "";
    const bu = b.updated || b.created || "";
    if (au !== bu) return bu.localeCompare(au);
    return a.name.localeCompare(b.name);
  });
}

function counts(projects) {
  const c = { all: projects.length };
  for (const s of STATUSES) c[s] = projects.filter((p) => p.status === s).length;
  return c;
}

function layout({ title, description, extraHead = "", bodyClass = "", main }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="theme-color" content="#0b0e0c">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
  ${extraHead}
</head>
<body class="${esc(bodyClass)}">
  <a class="skip" href="#main">Skip to inventory</a>
  <div class="shell">
    <header class="top">
      <div class="brand">
        <a href="/" class="mark" aria-label="Billy Command Center home">
          <span class="mark-dot" aria-hidden="true"></span>
          BCC
        </a>
        <div class="brand-copy">
          <p class="kicker">billycommandcenter.com</p>
          <h1>Command center</h1>
        </div>
      </div>
      <p class="lede">Personal inventory of sites and tools. Status is <code>shipped</code>, <code>dev</code>, or <code>broken</code>. Dates prefer GitHub <code>created_at</code>/<code>pushed_at</code> when HTTP <code>Last-Modified</code> is missing.</p>
    </header>
    <main id="main">
${main}
    </main>
    <footer class="foot">
      <p>Generated from <code>data/projects.json</code> by <code>scripts/build.mjs</code>. Do not edit HTML by hand.</p>
      <p><a href="https://github.com/Billyjameshowell/billycommandcenter">Source</a> · Cloudflare Pages · public</p>
    </footer>
  </div>
</body>
</html>
`;
}

function renderIndex(projects) {
  const sorted = sortProjects(projects);
  const c = counts(projects);
  const rows = sorted
    .map((p) => {
      const live = p.url
        ? `<a href="${esc(p.url)}" rel="noopener">${esc(hostLabel(p.url))}</a>`
        : `<span class="muted">no public URL</span>`;
      const gh = p.github
        ? `<a href="${esc(p.github)}" rel="noopener">${esc(githubLabel(p.github))}${p.githubPrivate ? ` <span class="lock" title="private repo">priv</span>` : ""}</a>`
        : `<span class="muted">—</span>`;
      return `<tr data-status="${esc(p.status)}">
  <td class="col-name"><a href="/projects/${esc(p.slug)}.html">${esc(p.name)}</a></td>
  <td class="col-status">${statusBadge(p.status)}</td>
  <td class="col-url">${live}</td>
  <td class="col-gh">${gh}</td>
  <td class="col-date"><time datetime="${esc(p.created || "")}">${fmtDate(p.created)}</time></td>
  <td class="col-date"><time datetime="${esc(p.updated || "")}">${fmtDate(p.updated)}</time></td>
  <td class="col-stack">${chips(p.stack)}</td>
  <td class="col-more"><a class="more" href="/projects/${esc(p.slug)}.html">details</a></td>
</tr>`;
    })
    .join("\n");

  const cards = sorted
    .map((p) => {
      const live = p.url
        ? `<a href="${esc(p.url)}" rel="noopener">${esc(hostLabel(p.url))}</a>`
        : `<span class="muted">no public URL</span>`;
      const gh = p.github
        ? `<a href="${esc(p.github)}" rel="noopener">${esc(githubLabel(p.github))}</a>${p.githubPrivate ? ` <span class="lock">priv</span>` : ""}`
        : `<span class="muted">no GitHub</span>`;
      return `<article class="card" data-status="${esc(p.status)}">
  <header>
    <h2><a href="/projects/${esc(p.slug)}.html">${esc(p.name)}</a></h2>
    ${statusBadge(p.status)}
  </header>
  <dl>
    <div><dt>Live</dt><dd>${live}</dd></div>
    <div><dt>GitHub</dt><dd>${gh}</dd></div>
    <div><dt>Created</dt><dd><time datetime="${esc(p.created || "")}">${fmtDate(p.created)}</time></dd></div>
    <div><dt>Modified</dt><dd><time datetime="${esc(p.updated || "")}">${fmtDate(p.updated)}</time></dd></div>
  </dl>
  <div class="chips">${chips(p.stack)}</div>
  <a class="more" href="/projects/${esc(p.slug)}.html">Open details →</a>
</article>`;
    })
    .join("\n");

  const filters = [
    ["all", c.all],
    ...STATUSES.map((s) => [s, c[s]]),
  ]
    .map(
      ([key, n], i) =>
        `<button type="button" class="filter${i === 0 ? " is-on" : ""}" data-filter="${key}">${esc(key)} <span>${n}</span></button>`,
    )
    .join("\n");

  const main = `      <section class="panel">
        <div class="panel-head">
          <h2>Inventory <span class="count">${c.all}</span></h2>
          <div class="filters" role="toolbar" aria-label="Filter by status">${filters}</div>
        </div>
        <div class="table-wrap">
          <table class="grid">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Live URL</th>
                <th>GitHub</th>
                <th>Created</th>
                <th>Modified</th>
                <th>Stack</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
${rows}
            </tbody>
          </table>
        </div>
        <div class="cards">
${cards}
        </div>
      </section>
      <script>
        (function () {
          var buttons = document.querySelectorAll("[data-filter]");
          var rows = document.querySelectorAll("[data-status]");
          buttons.forEach(function (btn) {
            btn.addEventListener("click", function () {
              var f = btn.getAttribute("data-filter");
              buttons.forEach(function (b) { b.classList.toggle("is-on", b === btn); });
              rows.forEach(function (el) {
                el.hidden = f !== "all" && el.getAttribute("data-status") !== f;
              });
            });
          });
        })();
      </script>`;

  return layout({
    title: "Billy Command Center",
    description: "Index of Billy’s live sites, GitHub repos, dates, and stacks.",
    bodyClass: "page-index",
    main,
  });
}

function renderDetail(p) {
  const live = p.url
    ? `<a href="${esc(p.url)}" rel="noopener">${esc(p.url)}</a>`
    : `<span class="muted">No public URL</span>`;
  const ghBadge = p.githubPrivate
    ? ` <span class="lock">private</span>`
    : ` <span class="chip">public</span>`;
  const gh = p.github
    ? `<a href="${esc(p.github)}" rel="noopener">${esc(p.github)}</a>${ghBadge}`
    : `<span class="muted">None on file</span>`;
  const extras = (p.extraLinks || [])
    .map((l) => `<li><a href="${esc(l.url)}" rel="noopener">${esc(l.label)}</a> <span class="muted">${esc(hostLabel(l.url))}</span></li>`)
    .join("");

  const main = `      <nav class="crumb"><a href="/">← Inventory</a></nav>
      <article class="detail">
        <header class="detail-head">
          <p class="kicker">${esc(p.slug)}</p>
          <h2>${esc(p.name)}</h2>
          ${statusBadge(p.status)}
        </header>
        <section class="facts">
          <div>
            <h3>Live URL</h3>
            <p>${live}</p>
          </div>
          <div>
            <h3>GitHub</h3>
            <p>${gh}</p>
          </div>
          <div>
            <h3>Created</h3>
            <p><time datetime="${esc(p.created || "")}">${fmtDate(p.created)}</time></p>
          </div>
          <div>
            <h3>Last modified</h3>
            <p><time datetime="${esc(p.updated || "")}">${fmtDate(p.updated)}</time></p>
          </div>
          <div>
            <h3>Date source</h3>
            <p>${esc(DATE_SOURCE_LABEL[p.dateSource] || p.dateSource || "—")}</p>
          </div>
        </section>
        <section>
          <h3>Full stack</h3>
          <div class="chips">${chips(p.stack, "chip-lg")}</div>
        </section>
        <section>
          <h3>Notes</h3>
          <p class="notes">${esc(p.notes)}</p>
        </section>
        ${
          extras
            ? `<section>
          <h3>More links</h3>
          <ul class="links">${extras}</ul>
        </section>`
            : ""
        }
        <p class="policy">${DATE_POLICY}</p>
      </article>`;

  return layout({
    title: `${p.name} · Billy Command Center`,
    description: p.notes || `${p.name} stack and links`,
    bodyClass: "page-detail",
    extraHead: `<link rel="canonical" href="/projects/${esc(p.slug)}.html">`,
    main,
  });
}

function wipeGeneratedHtml() {
  mkdirSync(PROJECTS_DIR, { recursive: true });
  for (const name of readdirSync(PROJECTS_DIR)) {
    if (name.endsWith(".html")) unlinkSync(join(PROJECTS_DIR, name));
  }
}

function main() {
  const projects = loadProjects();
  wipeGeneratedHtml();
  writeFileSync(join(ROOT, "index.html"), renderIndex(projects));
  for (const p of projects) {
    writeFileSync(join(PROJECTS_DIR, `${p.slug}.html`), renderDetail(p));
  }
  console.log(`wrote index.html + ${projects.length} project pages`);
}

main();
