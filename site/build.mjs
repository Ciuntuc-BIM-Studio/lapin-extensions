#!/usr/bin/env node
// The store site, store.lapinbim.com (Lapin decision 499, stage 1): static pages generated from the catalogue.
//   node site/build.mjs                        → dist/site/ from extensions/*/manifest.json (versions from git's history)
//   node site/build.mjs --index dist/publish/extensions/index.json --out dist/publish/site
//                                              the pages of a published (signed) index
//   node site/build.mjs --lang ro              a language of site/strings.mjs, under /<lang>/ (English is the root)
// Pages: the list (search and kind filters; it works without JavaScript, the script only filters), one page per extension
// at /extension/<id>/ (/extensions/ is the catalogue itself: index.json and the files)
// (description, screenshots, versions, licence marked permissive / read its terms / non-commercial, the Lapin versions it
// works with, size, SHA-256, author, homepage, forum topic, how to install it in Lapin, downloads counted by the store),
// author pages, how to publish, the legal drafts (legal/*.md). The author dashboard and the API are the store service's
// (lapin-pro: deploy/store/). Every text from a manifest is escaped. Node 22, no dependencies.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, readManifests, versionsOf } from '../tools/catalogue.mjs';
import { isNonCommercial, isPermissive, KINDS, SCREENSHOT_FILE } from '../tools/lib.mjs';
import { STRINGS, t } from './strings.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');

export const KIND_ORDER = ['furniture', 'template', 'types', 'profiles', 'hatches', 'titleBlock', 'priceList', 'symbols', 'lineTypes', 'standards', 'rules', 'barShapes', 'parameters', 'mapping', 'families', 'script'];
const LEGAL = [['terms-of-use', 'footer.terms'], ['author-terms', 'footer.authorTerms'], ['privacy', 'footer.privacy'], ['notice-and-action', 'footer.notice']];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** A URL fit for an attribute: https only (a manifest's addresses are checked, this is the last guard). */
const href = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(u ?? '') ? esc(u) : '#');
/** A path segment for an author: their GitHub or forum name, else their name, lowercased, letters and digits. */
export const authorSlug = (a) => (a.github ?? a.forum ?? a.name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'author';
export const sizeText = (b) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
/** The licence's mark: non-commercial first (it says the most), then permissive, else read its terms. */
export const licenceMark = (expr) => (isNonCommercial(expr) ? 'nc' : isPermissive(expr) ? 'permissive' : 'terms');

/** A small Markdown subset to HTML (the legal drafts): headings, paragraphs, lists, bold, italics, code, links. */
export function markdown(md) {
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+|mailto:[^)\s]+|[a-z0-9-]+\.html)\)/g, '<a href="$2">$1</a>');
  const out = [];
  let list = null, para = [], table = null;
  const cells = (line) => line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
  const flush = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
    if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; }
    if (table) {
      const [head, ...rows] = table;
      out.push(`<table class="list"><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      table = null;
    }
  };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flush(); continue; }
    if (/^\s*\|/.test(line)) {
      if (!table) flush();
      if (!/^\s*\|[\s|:-]+\|?\s*$/.test(line)) (table ??= []).push(cells(line));
      continue;
    }
    if (table) flush();
    if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) { flush(); out.push(`<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`); continue; }
    if ((m = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(line))) {
      if (para.length) flush();
      const tag = /\d/.test(m[1]) ? 'ol' : 'ul';
      if (list && list.tag !== tag) flush();
      list ??= { tag, items: [] };
      list.items.push(m[2]);
      continue;
    }
    if (list && /^\s{2,}\S/.test(raw)) { list.items[list.items.length - 1] += ` ${line.trim()}`; continue; }
    if (list) flush();
    para.push(line.trim());
  }
  flush();
  return out.join('\n');
}

function page({ lang, base, title, description, body, active }) {
  const T = (k, v) => t(lang, k, v);
  const nav = [['', 'nav.extensions', 'extensions'], ['authors/', 'nav.authors', 'authors'], ['publish/', 'nav.publish', 'publish']]
    .map(([p, k, id]) => `<a href="${base}${p}"${active === id ? ' aria-current="page"' : ''}>${esc(T(k))}</a>`).join('');
  return `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="stylesheet" href="/assets/store.css">
<link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
<script src="/assets/theme.js"></script>
</head>
<body>
<header class="top">
  <a class="brand" href="${base}"><span class="brand-mark">L</span><span>Lapin <span class="brand-sub">Extensions</span></span></a>
  <nav>${nav}</nav>
  <span class="grow"></span>
  <a class="btn" href="/dashboard/">${esc(T('nav.dashboard'))}</a>
  <button type="button" class="icon" data-theme-toggle title="${esc(T('nav.theme'))}" aria-label="${esc(T('nav.theme'))}">◐</button>
</header>
<main>
${body}
</main>
<footer class="foot">
  <p>${esc(T('footer.operator'))} <a href="https://github.com/Ciuntuc-BIM-Studio/lapin-extensions">${esc(T('footer.source'))}</a></p>
  <p>${LEGAL.map(([f, k]) => `<a href="${base}legal/${f}.html">${esc(T(k))}</a>`).join(' · ')}</p>
</footer>
<script src="/assets/store.js" defer></script>
</body>
</html>
`;
}

const chip = (lang, mark) => `<span class="chip ${mark === 'permissive' ? 'ok' : 'warn'}" data-licence="${mark}" title="${esc(t(lang, `licence.${mark}.title`))}">${esc(t(lang, `licence.${mark === 'nc' ? 'nc' : mark}`))}</span>`;

function card(lang, base, m) {
  const words = [m.name, m.summary, m.description ?? '', m.author.name, ...(m.tags ?? []), ...(m.contents.items ?? []), m.id].join(' ').toLowerCase();
  const mark = licenceMark(m.license);
  return `<a class="card" href="${base}extension/${esc(m.id)}/" data-kind="${esc(m.kind)}" data-words="${esc(words)}" data-extension="${esc(m.id)}">
  <span class="card-kind eyebrow">${esc(t(lang, `kind.${m.kind}`))}</span>
  <span class="card-name">${esc(m.name)}</span>
  <span class="card-summary">${esc(m.summary)}</span>
  <span class="card-foot"><span class="muted">${esc(m.author.name)} · ${esc(m.version)}</span>${mark === 'permissive' ? '' : ` ${chip(lang, mark)}`}</span>
</a>`;
}

function listPage(lang, base, list) {
  const T = (k, v) => t(lang, k, v);
  const counts = Object.fromEntries(KIND_ORDER.map((k) => [k, list.filter((m) => m.kind === k).length]));
  const chips = [`<button type="button" class="tab-chip on" data-filter-kind="">${esc(T('filter.all'))}</button>`,
    ...KIND_ORDER.filter((k) => counts[k]).map((k) => `<button type="button" class="tab-chip" data-filter-kind="${k}">${esc(T(`kind.${k}`))} <span class="muted">${counts[k]}</span></button>`)].join('');
  const body = `<section class="hero">
  <h1>${esc(T('site.title'))}</h1>
  <p class="lede">${esc(T('site.tagline'))}</p>
</section>
<section class="browse">
  <div class="search"><input type="search" placeholder="${esc(T('search.placeholder'))}" aria-label="${esc(T('search.placeholder'))}" data-search></div>
  <div class="chips" role="group">${chips}</div>
  <p class="muted small" data-count data-template="${esc(T('list.count', { n: '{n}' }))}">${esc(T('list.count', { n: list.length }))}</p>
  ${list.length ? `<div class="cards">${list.map((m) => card(lang, base, m)).join('\n')}</div>` : `<p class="muted">${esc(T('list.empty'))}</p>`}
  <p class="muted" data-none hidden>${esc(T('search.none'))}</p>
</section>`;
  return page({ lang, base, title: T('site.title'), description: T('site.tagline'), body, active: 'extensions' });
}

function screenshotsOf(m, base) {
  return (m.screenshots ?? []).map((s) => (SCREENSHOT_FILE.test(s) ? `${base}extension/${esc(m.id)}/${esc(s)}` : href(s)));
}

function extensionPage(lang, base, m, { versions = [], store }) {
  const T = (k, v) => t(lang, k, v);
  const mark = licenceMark(m.license);
  const single = /^[A-Za-z0-9.+-]+$/.test(m.license) && !m.license.startsWith('LicenseRef-');
  const licence = `${single ? `<a href="https://spdx.org/licenses/${esc(m.license.replace(/\+$/, ''))}.html">${esc(m.license)}</a>` : esc(m.license)} ${chip(lang, mark)}`;
  const author = `<a href="${base}authors/${esc(authorSlug(m.author))}/">${esc(m.author.name)}</a>${m.author.github ? ` <span class="muted">@${esc(m.author.github)}</span>` : ''}`;
  const dl = (rows) => `<dl class="facts">${rows.filter(Boolean).map(([k, v]) => `<dt>${esc(T(k))}</dt><dd>${v}</dd>`).join('')}</dl>`;
  const shots = screenshotsOf(m, base);
  const download = m.package.download ?? m.package.mirror ?? m.package.url;
  const vrows = versions.length ? versions : [{ version: m.version, lapin: m.lapin, size: m.package.size }];
  const body = `<nav class="crumbs"><a href="${base}">${esc(T('nav.extensions'))}</a> / <a href="${base}?kind=${esc(m.kind)}">${esc(T(`kind.${m.kind}`))}</a></nav>
<article class="extension" data-extension-page="${esc(m.id)}">
  <header>
    <span class="eyebrow">${esc(T(`kind.${m.kind}`))}</span>
    <h1>${esc(m.name)} <span class="muted version">${esc(m.version)}</span></h1>
    <p class="lede">${esc(m.summary)}</p>
    <p class="muted">${T('x.by', { author })}</p>
  </header>
  <div class="extension-grid">
    <div class="extension-main">
      ${m.description ? `<div class="description">${esc(m.description).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}</div>` : ''}
      ${shots.length ? `<h2>${esc(T('x.screenshots'))}</h2><div class="shots">${shots.map((s, i) => `<a href="${s}"><img src="${s}" alt="${esc(m.name)} ${i + 1}" loading="lazy"></a>`).join('')}</div>` : ''}
      ${m.contents.items?.length ? `<h2>${esc(T('x.contents'))}</h2><ul class="items">${m.contents.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
      ${KINDS[m.kind]?.code ? `<div class="notice warn"><p>${esc(T('x.code'))}</p>${m.permissions?.length ? `<p class="eyebrow">${esc(T('x.permissions'))}</p><ul>${m.permissions.map((p) => `<li>${esc(T(`perm.${p}`))}</li>`).join('')}</ul>` : ''}</div>` : ''}
      ${m.kind === 'priceList' || m.kind === 'rules' ? `<div class="notice"><p>${esc(T('x.indicative'))}</p></div>` : ''}
      <h2>${esc(T('x.versions'))}</h2>
      <table class="versions"><thead><tr><th>${esc(T('x.version'))}</th><th>${esc(T('x.lapin'))}</th><th>${esc(T('x.size'))}</th><th>${esc(T('x.versions.date'))}</th></tr></thead>
      <tbody>${vrows.map((v) => `<tr><td>${esc(v.version)}</td><td>Lapin ${esc(v.lapin ?? '')}</td><td>${v.size ? esc(sizeText(v.size)) : ''}</td><td>${v.date ? esc(v.date.slice(0, 10)) : ''}</td></tr>`).join('')}</tbody></table>
    </div>
    <aside class="extension-side">
      <div class="install">
        <h2>${esc(T('x.install'))}</h2>
        <p>${esc(T('x.install.how', { name: m.name }))}</p>
        <p><code class="id">${esc(m.id)}</code> <button type="button" class="btn small" data-copy="${esc(m.id)}" data-copied="${esc(T('x.install.copied'))}">${esc(T('x.install.copy'))}</button></p>
        <p><a class="btn small" href="${href(download)}" rel="nofollow" data-download>${esc(T('x.download'))}</a></p>
        <p class="muted small">${esc(T('x.download.note'))}</p>
      </div>
      ${dl([
        ['x.kind', esc(T(`kind.${m.kind}`))],
        ['x.goes', esc(T(`where.${m.kind}`))],
        ['x.licence', licence],
        ['x.lapin', `Lapin ${esc(m.lapin)}`],
        ['x.size', esc(sizeText(m.package.size))],
        ['x.file', `<code>${esc(m.contents.file)}</code>`],
        ['x.sha', `<code class="sha">${esc(m.package.sha256)}</code>`],
        m.package.signature ? ['x.signed', `<span class="chip ok" title="${esc(T('x.signed.title'))}">✓</span>`] : null,
        ['x.author', author],
        m.languages?.length ? ['x.languages', esc(m.languages.join(', '))] : null,
        m.homepage ? ['x.homepage', `<a href="${href(m.homepage)}">${esc(m.homepage.replace(/^https:\/\//, ''))}</a>`] : null,
        m.forum ? ['x.forum', `<a href="${href(m.forum)}">forum.lapinbim.com</a>`] : null,
        store ? ['x.downloads', `<span data-downloads="${esc(m.id)}" data-stats="${esc(store)}">–</span>`] : null,
      ])}
    </aside>
  </div>
</article>`;
  return page({ lang, base, title: `${m.name} · ${T('site.title')}`, description: m.summary, body });
}

function authorsOf(list) {
  const by = new Map();
  for (const m of list) {
    const slug = authorSlug(m.author);
    if (!by.has(slug)) by.set(slug, { slug, author: m.author, list: [] });
    const a = by.get(slug);
    a.list.push(m);
    a.author = { ...m.author, ...a.author };
  }
  return [...by.values()].sort((a, b) => a.author.name.localeCompare(b.author.name));
}

function authorPage(lang, base, a) {
  const T = (k, v) => t(lang, k, v);
  const links = [
    a.author.url && `<a href="${href(a.author.url)}">${esc(T('author.website'))}</a>`,
    a.author.github && `<a href="https://github.com/${esc(a.author.github)}">${esc(T('author.github'))}</a>`,
    a.author.forum && `<a href="https://forum.lapinbim.com/u/${esc(a.author.forum)}">${esc(T('author.forum'))}</a>`,
  ].filter(Boolean).join(' · ');
  const body = `<nav class="crumbs"><a href="${base}authors/">${esc(T('nav.authors'))}</a></nav>
<section data-author-page="${esc(a.slug)}"><h1>${esc(T('author.title', { author: a.author.name }))}</h1>${links ? `<p>${links}</p>` : ''}
<div class="cards">${a.list.map((m) => card(lang, base, m)).join('\n')}</div></section>`;
  return page({ lang, base, title: `${a.author.name} · ${T('site.title')}`, description: T('author.title', { author: a.author.name }), body, active: 'authors' });
}

function authorsPage(lang, base, authors) {
  const T = (k, v) => t(lang, k, v);
  const body = `<h1>${esc(T('authors.title'))}</h1><ul class="authors">${authors.map((a) => `<li><a href="${base}authors/${esc(a.slug)}/">${esc(a.author.name)}</a> <span class="muted">${esc(T('authors.count', { n: a.list.length }))}</span></li>`).join('')}</ul>`;
  return page({ lang, base, title: `${T('authors.title')} · ${T('site.title')}`, description: T('authors.title'), body, active: 'authors' });
}

function publishPage(lang, base) {
  const T = (k, v) => t(lang, k, v);
  const body = `<h1>${esc(T('publish.title'))}</h1><p class="lede">${esc(T('publish.intro'))}</p>
<div class="two">
  <section class="panel"><h2>${esc(T('publish.store'))}</h2><p>${esc(T('publish.store.text'))}</p><p><a class="btn primary" href="/dashboard/">${esc(T('publish.store.go'))}</a></p></section>
  <section class="panel"><h2>${esc(T('publish.github'))}</h2><p>${esc(T('publish.github.text'))}</p><p><a class="btn" href="https://github.com/Ciuntuc-BIM-Studio/lapin-extensions#publishing-an-extension">GitHub</a></p></section>
</div>
<p>${esc(T('publish.review'))}</p>
<p><a href="https://github.com/Ciuntuc-BIM-Studio/lapin-extensions#rules">${esc(T('publish.rules'))}</a> · <a href="${base}legal/author-terms.html">${esc(T('footer.authorTerms'))}</a></p>`;
  return page({ lang, base, title: `${T('publish.title')} · ${T('site.title')}`, description: T('publish.intro'), body, active: 'publish' });
}

function legalPage(lang, base, file, key, root) {
  const T = (k, v) => t(lang, k, v);
  const localized = join(root, 'legal', lang, `${file}.md`);
  const path = lang !== 'en' && existsSync(localized) ? localized : join(root, 'legal', `${file}.md`);
  if (!existsSync(path)) return null;
  const body = `<article class="legal"><p class="notice warn">${esc(T('footer.draft'))}</p>${markdown(readFileSync(path, 'utf8'))}</article>`;
  return page({ lang, base, title: `${T(key)} · ${T('site.title')}`, description: T(key), body });
}

const write = (path, text) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); };

/**
 * The site written to `out`: one language (`lang`, its pages under /<lang>/ unless English), with the assets.
 * `index`: the catalogue's index; `root`: the catalogue's checkout (screenshots, legal drafts, versions);
 * `store`: the store's API address for the download counts (none: not shown).
 */
export function buildSite({ index, root = ROOT, out, lang = 'en', store = '/api/', history = true }) {
  if (!STRINGS[lang]) throw new Error(`no texts for ${lang} in site/strings.mjs`);
  const base = lang === 'en' ? '/' : `/${lang}/`;
  const dir = lang === 'en' ? out : join(out, lang);
  const list = [...index.extensions].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  write(join(dir, 'index.html'), listPage(lang, base, list));
  for (const m of list) {
    const versions = history ? versionsOf(root, m.id) : [];
    write(join(dir, 'extension', m.id, 'index.html'), extensionPage(lang, base, m, { versions, store }));
    for (const s of m.screenshots ?? []) {
      const src = join(root, 'extensions', m.id, s);
      if (SCREENSHOT_FILE.test(s) && existsSync(src)) { mkdirSync(join(dir, 'extension', m.id), { recursive: true }); copyFileSync(src, join(dir, 'extension', m.id, s)); }
    }
  }
  const authors = authorsOf(list);
  write(join(dir, 'authors', 'index.html'), authorsPage(lang, base, authors));
  for (const a of authors) write(join(dir, 'authors', a.slug, 'index.html'), authorPage(lang, base, a));
  write(join(dir, 'publish', 'index.html'), publishPage(lang, base));
  for (const [file, key] of LEGAL) { const html = legalPage(lang, base, file, key, root); if (html) write(join(dir, 'legal', `${file}.html`), html); }
  write(join(dir, '404.html'), page({ lang, base, title: t(lang, 'notfound.title'), description: t(lang, 'notfound.text'), body: `<h1>${esc(t(lang, 'notfound.title'))}</h1><p>${esc(t(lang, 'notfound.text'))}</p><p><a href="${base}">${esc(t(lang, 'nav.extensions'))}</a></p>` }));
  mkdirSync(join(out, 'assets'), { recursive: true });
  for (const f of readdirSync(join(here, 'assets'))) copyFileSync(join(here, 'assets', f), join(out, 'assets', f));
  return { pages: list.length + authors.length + 4, authors: authors.length };
}

// Run as a command (node site/build.mjs); imported (the tests, publish.mjs), it only exports.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const argv = process.argv.slice(2);
  const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const out = opt('--out', join(ROOT, 'dist', 'site'));
  const from = opt('--index', null);
  const index = from ? JSON.parse(readFileSync(from, 'utf8')) : buildIndex(readManifests(ROOT));
  if (!argv.includes('--keep')) rmSync(out, { recursive: true, force: true });
  const langs = (opt('--lang', 'en')).split(',');
  for (const lang of langs) {
    const r = buildSite({ index, out, lang, store: opt('--store', '/api/') });
    console.log(`${lang}: ${index.extensions.length} extension(s), ${r.authors} author(s) → ${out}`);
  }
}
