#!/usr/bin/env node
// The catalogue's index, built from one manifest per extension (extensions/<id>/manifest.json):
//   node tools/build-index.mjs                       → index.json, what lapinbim.com/extensions/index.json serves
//   node tools/build-index.mjs --mirror https://lapinbim.com/extensions/files/
//                                                    each package also named at <mirror><id>/<version>/<file> (the browser
//                                                    edition reads those: GitHub's release files answer no browser); the
//                                                    deploy copies the files there after checking their SHA-256
//   node tools/build-index.mjs --local               → dist/index.json naming the packages in dist/ (a catalogue on this
//                                                    computer: File → Extensions… → Catalogue… → its path, or
//                                                    LAPIN_EXTENSIONS_INDEX=<path> pnpm dev)
// Every manifest is checked first (lib.mjs); one that fails stops the build. Node 22, no dependencies.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest } from './lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const local = argv.includes('--local');
const mi = argv.indexOf('--mirror');
const mirror = mi >= 0 ? argv[mi + 1].replace(/\/?$/, '/') : null;

const dir = join(root, 'extensions');
const extensions = [];
for (const id of readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
  const m = JSON.parse(readFileSync(join(dir, id, 'manifest.json'), 'utf8'));
  const errs = validateManifest(m);
  if (errs.length || m.id !== id) { console.error(`✗ ${id}: ${errs[0] ?? `its folder is named ${id}, its id is ${m.id}`}`); process.exit(1); }
  if (local) {
    if (!existsSync(join(root, 'dist', id, m.contents.file))) { console.error(`✗ ${id}: no dist/${id}/${m.contents.file}`); process.exit(1); }
    m.package = { ...m.package, url: `${id}/${m.contents.file}` };
    delete m.package.mirror;
  } else if (mirror) m.package = { ...m.package, mirror: `${mirror}${id}/${m.version}/${m.contents.file}` };
  extensions.push(m);
}

const index = { format: 'lapin-extensions-index', version: 1, generated: new Date().toISOString(), extensions };
const out = local ? join(root, 'dist', 'index.json') : join(root, 'index.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(index, null, 2) + '\n');
console.log(`${extensions.length} extension(s) → ${out}`);
