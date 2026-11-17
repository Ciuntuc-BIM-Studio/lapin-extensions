#!/usr/bin/env node
// Checks the catalogue's manifests and their packages, as the pull-request check does (.github/workflows/validate.yml):
//   node tools/validate.mjs                         every manifest, each package downloaded from its release
//   node tools/validate.mjs --local                 every manifest, each package read from dist/<id>/<file>
//   node tools/validate.mjs --only <id>[,<id>…]     those extensions only (the CI passes the ones a pull request touches)
//   node tools/validate.mjs --base origin/main      a changed extension's version must be higher than on that ref
//   node tools/validate.mjs --pr-author <login> [--maintainer]
//                                                   an extension already listed is changed by its author only (or a maintainer)
// A package is checked for its size and SHA-256 against the manifest, then as its kind's file (lib.mjs). A paid one
// (stage 2a) has no public copy: it is read from private/<id>/<version>/<file> (git-ignored: the file the author handed
// over privately) when the maintainer has it there, else only its manifest is checked here (the store checked the file
// when the author uploaded it). Exit 1 on any problem, each one printed. Node 22, no dependencies.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPackage, isNonCommercial, isPaid, isPermissive, MAX_PACKAGE, PROVIDERS, SCREENSHOT_FILE, sha256, validateManifest } from './lib.mjs';

const MAX_SCREENSHOT = 2 * 1024 * 1024;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const local = flag('--local');
const only = opt('--only')?.split(',').map((s) => s.trim()).filter(Boolean);
const base = opt('--base');
const prAuthor = opt('--pr-author');
const maintainer = flag('--maintainer');

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/;
function newer(a, b) {
  const x = SEMVER.exec(a), y = SEMVER.exec(b);
  if (!x || !y) return false;
  for (let i = 1; i <= 3; i++) if (+x[i] !== +y[i]) return +x[i] > +y[i];
  return !x[4] && !!y[4];
}

function previous(id) {
  if (!base) return null;
  try { return JSON.parse(execFileSync('git', ['show', `${base}:extensions/${id}/manifest.json`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch { return null; }
}

/** A paid package handed over privately: private/<id>/<version>/<file> (never in git). */
const privatePath = (m) => join(root, 'private', m.id, m.version, m.contents.file);

async function packageBytes(m) {
  if (isPaid(m)) return existsSync(privatePath(m)) ? readFileSync(privatePath(m)) : null;
  if (local) {
    const f = join(root, 'dist', m.id, m.contents.file);
    if (!existsSync(f)) throw new Error(`no ${f} (node tools/make-examples.mjs, or put the file there)`);
    return readFileSync(f);
  }
  const res = await fetch(m.package.url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${m.package.url} answered ${res.status}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_PACKAGE) throw new Error('the package is bigger than an extension may be');
  return Buffer.from(await res.arrayBuffer());
}

const dir = join(root, 'extensions');
const ids = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).filter((id) => !only || only.includes(id));
let problems = 0;
const fail = (id, msg) => { problems++; console.error(`✗ ${id}: ${msg}`); };

for (const id of ids) {
  const path = join(dir, id, 'manifest.json');
  if (!existsSync(path)) { fail(id, 'no manifest.json in its folder'); continue; }
  const files = readdirSync(join(dir, id));
  const extra = files.filter((f) => !['manifest.json', 'README.md', 'icon.png'].includes(f) && !SCREENSHOT_FILE.test(f));
  if (extra.length) fail(id, `only manifest.json, README.md, icon.png and screenshots (screenshot.webp, screenshot-2.png…) go in its folder (the package goes in a release): ${extra.join(', ')}`);
  for (const f of files.filter((x) => SCREENSHOT_FILE.test(x))) if (statSync(join(dir, id, f)).size > MAX_SCREENSHOT) fail(id, `${f} is bigger than ${MAX_SCREENSHOT / 1024 / 1024} MB`);
  let m;
  try { m = JSON.parse(readFileSync(path, 'utf8')); } catch (e) { fail(id, `manifest.json is not JSON: ${e.message}`); continue; }
  const errs = validateManifest(m);
  for (const e of errs) fail(id, e);
  if (errs.length) continue;
  if (m.id !== id) { fail(id, `its folder is named ${id}, its id is ${m.id}`); continue; }
  for (const s of m.screenshots ?? []) if (SCREENSHOT_FILE.test(s) && !files.includes(s)) fail(id, `screenshots names ${s}, which is not in its folder`);
  const before = previous(id);
  if (before && JSON.stringify(before) !== JSON.stringify(m)) {
    if (!newer(m.version, before.version)) fail(id, `changed, so its version must be higher than ${before.version}`);
    if (prAuthor && !maintainer && before.author?.github && before.author.github.toLowerCase() !== prAuthor.toLowerCase()) fail(id, `listed by @${before.author.github}: only its author (or a maintainer) changes it`);
  }
  if (!before && prAuthor && !maintainer && m.author.github && m.author.github.toLowerCase() !== prAuthor.toLowerCase()) fail(id, `author.github is @${m.author.github}, the pull request is @${prAuthor}'s`);
  try {
    const bytes = await packageBytes(m);
    const sold = isPaid(m) ? `, paid: ${PROVIDERS[m.purchase.provider]} ${m.purchase.productId}${m.purchase.price ? `, ${m.purchase.price}` : ''}` : '';
    if (!bytes) { console.log(`✓ ${id} ${m.version} (${m.kind}, ${m.license}${sold}): the manifest only; the package is checked privately (the store at upload, or private/${id}/${m.version}/${m.contents.file})`); continue; }
    if (bytes.length !== m.package.size) fail(id, `the package is ${bytes.length} bytes, the manifest says ${m.package.size}`);
    else if (sha256(bytes) !== m.package.sha256) fail(id, `the package's SHA-256 is ${sha256(bytes)}, the manifest says ${m.package.sha256}`);
    else {
      const items = checkPackage(m.kind, bytes);
      const terms = isNonCommercial(m.license) ? ", non-commercial" : isPermissive(m.license) ? ", permissive" : ", read its terms";
      console.log(`✓ ${id} ${m.version} (${m.kind}, ${m.license}${terms}${sold})${items.length ? `: ${items.slice(0, 6).join(', ')}${items.length > 6 ? '…' : ''}` : ''}`);
    }
  } catch (e) { fail(id, `package: ${e.message}`); }
}

if (problems) { console.error(`${problems} problem(s).`); process.exit(1); }
console.log(`${ids.length} extension(s) checked.`);
