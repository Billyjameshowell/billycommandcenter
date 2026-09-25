#!/usr/bin/env node
/**
 * Structural checks for generated inventory markup + sort/filter math.
 * Run after: node scripts/build.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const css = readFileSync(join(ROOT, "styles.css"), "utf8");
const js = readFileSync(join(ROOT, "inventory.js"), "utf8");
const readme = readFileSync(join(ROOT, "README.md"), "utf8");

assert.match(html, /inventory\.js/);
assert.match(html, /data-inventory/);
assert.match(html, /data-rows/);
assert.match(html, /data-cards/);
assert.match(html, /data-sort="title"/);
assert.match(html, /data-sort="created"/);
assert.match(html, /data-sort="modified"/);
assert.match(html, /data-sort-clear/);
assert.match(html, /data-filter="all"/);
assert.match(html, /data-filter="shipped"/);
assert.match(html, /data-filter="dev"/);
assert.match(html, /data-filter="broken"/);
assert.doesNotMatch(html, /<script>\s*\(function \(\) \{\s*var buttons/);

const rowRe = /<tr data-item([^>]*)>/g;
const cardRe = /<article class="card" data-item([^>]*)>/g;
function attrs(chunk) {
  const get = (name) => {
    const m = chunk.match(new RegExp(`data-${name}="([^"]*)"`));
    assert.ok(m, `missing data-${name} in ${chunk}`);
    return m[1];
  };
  return {
    slug: get("slug"),
    status: get("status"),
    title: get("title"),
    created: get("created"),
    modified: get("modified"),
    index: Number(get("index")),
  };
}
const rows = [...html.matchAll(rowRe)].map((m) => attrs(m[1]));
const cards = [...html.matchAll(cardRe)].map((m) => attrs(m[1]));
assert.equal(rows.length, 24);
assert.equal(cards.length, 24);
assert.deepEqual(
  rows.map((r) => r.slug),
  cards.map((c) => c.slug),
);
for (const item of rows) {
  assert.ok(["shipped", "dev", "broken"].includes(item.status), item.slug);
  assert.ok(item.title);
}

const shipped = rows.filter((r) => r.status === "shipped").length;
const dev = rows.filter((r) => r.status === "dev").length;
const broken = rows.filter((r) => r.status === "broken").length;
assert.equal(shipped + dev + broken, 24);
assert.equal(dev, 6);
assert.equal(shipped, 18);

function sortBy(list, key, dir) {
  return [...list].sort((a, b) => {
    const av = (a[key] || "").toLowerCase();
    const bv = (b[key] || "").toLowerCase();
    if (key === "title") {
      const cmp = av.localeCompare(bv);
      return dir === "desc" ? -cmp : cmp;
    }
    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;
    const cmp = av.localeCompare(bv);
    return dir === "desc" ? -cmp : cmp;
  });
}
const titleAsc = sortBy(rows, "title", "asc");
assert.ok(titleAsc[0].title.toLowerCase() < titleAsc.at(-1).title.toLowerCase());
const createdDesc = sortBy(rows, "created", "desc");
assert.ok(createdDesc[0].created, "newest-created should be a dated row");
assert.ok(createdDesc[0].created >= createdDesc.filter((r) => r.created).at(-1).created);
assert.equal(createdDesc.at(-1).created, "", "undated created should sort last");

assert.match(css, /\.is-out/);
assert.match(css, /display:\s*none\s*!important/);
assert.doesNotMatch(css, /#c6e04a/);
assert.doesNotMatch(css, /#0b0e0c/);
assert.match(css, /background:\s*#fff/);

assert.match(js, /localStorage/);
assert.match(js, /data-rows/);
assert.match(js, /data-cards/);
assert.match(js, /is-out/);

assert.match(readme, /not Astro/i);
assert.match(readme, /scripts\/build\.mjs/);
assert.match(readme, /projects\.json/);

console.log(`ok: ${rows.length} rows/cards, shipped=${shipped} dev=${dev} broken=${broken}`);
