#!/usr/bin/env node
// The catalogue's index, built from one manifest per extension (extensions/<id>/manifest.json):
//   node tools/build-index.mjs                       → index.json, what lapinbim.com/extensions/index.json serves
//   node tools/build-index.mjs --mirror https://lapinbim.com/extensions/files/
//                                                    each package also named at <mirror><id>/<version>/<file> (the browser
//                                                    edition reads those: GitHub's release files answer no browser); the
//                                                    deploy copies the files there after checking their SHA-256
//   node tools/build-index.mjs --download https://store.lapinbim.com/api/download/
//                                                    each package's counting address <download><id>/<version>: the store
//                                                    counts the download and redirects to the copy (Lapin tries it first)
//   node tools/build-index.mjs --local               → dist/index.json naming the packages in dist/ (a catalogue on this
//                                                    computer: File → Extensions… → Catalogue… → its path, or
//                                                    LAPIN_EXTENSIONS_INDEX=<path> pnpm dev)
// Every manifest is checked first (lib.mjs); one that fails stops the build. The published index is also signed by the
// store key: tools/publish.mjs. Node 22, no dependencies.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, readManifests } from './catalogue.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const local = argv.includes('--local');

let index;
try {
  index = buildIndex(readManifests(root), { local, mirror: opt('--mirror'), download: opt('--download'), root });
} catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }

const out = local ? join(root, 'dist', 'index.json') : join(root, 'index.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(index, null, 2) + '\n');
console.log(`${index.extensions.length} extension(s) → ${out}`);
