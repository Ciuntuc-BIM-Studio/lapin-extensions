#!/usr/bin/env node
// The three example extensions made by Ciuntuc BIM Studio, built into dist/ by a Lapin engine (a lapin-pro checkout
// built with `pnpm setup`), their manifests given the files' size and SHA-256:
//   ro.ciuntucbimstudio.mobilier-living   furniture   six living-room types, as My furniture → Export writes them
//   ro.ciuntucbimstudio.sablon-romania    template    a project template set up the Romanian way
//   ro.ciuntucbimstudio.pereti-perimetrali script     a Python script (runs once Lapin has its Python console)
//
//   node tools/make-examples.mjs [--lapin ../lapin-pro]
//
// The .lapinlib and .lapin hold dates and new GlobalIds, so each run gives new bytes: attach the files of the run whose
// manifests you commit (dist/SHA256SUMS.txt lists them). Node 22, no dependencies.
import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startEngine } from './engine.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const lapin = resolve(arg('--lapin', join(root, '../lapin-pro')));
const dist = join(root, 'dist');

const n = (v) => (Math.round(v * 10000) / 10000).toString();
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/** The engine's preview drawn as My furniture draws its thumbnails: the front, its pieces in their materials' colours. */
function thumbnail(p, size = 160) {
  const front = p.front ?? [];
  if (!front.length) return undefined;
  const x0 = Math.min(...front.map((f) => f.x0), -0.1), x1 = Math.max(...front.map((f) => f.x1), 0.1);
  const z1 = Math.max(...front.map((f) => f.z1), 0.1);
  const span = Math.max(x1 - x0, z1) * 1.12;
  const cx = (x0 + x1) / 2, cy = -z1 / 2;
  const rects = front.map((f) => `<rect x="${n(f.x0)}" y="${n(-f.z1)}" width="${n(f.x1 - f.x0)}" height="${n(f.z1 - f.z0)}" fill="${esc(f.color)}" stroke="rgba(0,0,0,.35)" stroke-width="${n(span / 260)}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${n(cx - span / 2)} ${n(cy - span / 2)} ${n(span)} ${n(span)}">${rects}<line x1="${n(cx - span / 2)}" x2="${n(cx + span / 2)}" y1="0" y2="0" stroke="#777" stroke-width="${n(span / 200)}"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** A manifest given its package's size and SHA-256 (and its items, when given). */
function stamp(id, file, bytes, items) {
  const path = join(root, 'extensions', id, 'manifest.json');
  const m = JSON.parse(readFileSync(path, 'utf8'));
  m.package.size = bytes.length;
  m.package.sha256 = sha256(bytes);
  if (items) m.contents.items = items;
  writeFileSync(path, JSON.stringify(m, null, 2) + '\n');
  return `${m.package.sha256}  ${id}/${file}`;
}

const FURNITURE = [
  { kind: 'casework', preset: 'sideboard', name: 'Comodă stejar', category: 'living', tags: ['stejar', 'oak'], spec: { materials: { fronts: 'Lacquered MDF sage' } } },
  { kind: 'casework', preset: 'tvUnit', name: 'Comodă TV nuc', category: 'living', tags: ['nuc', 'walnut', 'tv'], spec: { frontStyle: 'fluted', materials: { fronts: 'Walnut veneer' } } },
  { kind: 'casework', preset: 'bookcase', name: 'Bibliotecă înaltă', category: 'storage', tags: ['stejar', 'oak'], spec: {} },
  { kind: 'sofa', name: 'Canapea 3 locuri', category: 'living', tags: ['canapea', 'sofa'] },
  { kind: 'armchair', name: 'Fotoliu', category: 'living', tags: ['fotoliu', 'armchair'] },
  { kind: 'coffeeTable', name: 'Măsuță de cafea', category: 'living', tags: ['masă', 'table'] },
];

async function furniture(e) {
  await e.call('project.new', {});
  const entries = [];
  for (const f of FURNITURE) {
    const { id } = await e.execute('furniture.createType', { kind: f.kind, name: f.name, ...(f.preset ? { preset: f.preset } : {}), ...(f.spec ? { spec: f.spec } : {}) });
    const type = await e.query('furniture.libraryItem', { typeId: id });
    const preview = await e.query('furniture.preview', { kind: type.spec.kind, spec: type.spec });
    entries.push({ id: randomUUID().replace(/-/g, ''), name: f.name, category: f.category, tags: f.tags, thumbnail: thumbnail(preview), at: new Date().toISOString(), type });
  }
  const { data } = await e.call('furnitureLibrary.pack', { entries });
  const bytes = Buffer.from(data, 'base64');
  mkdirSync(join(dist, 'ro.ciuntucbimstudio.mobilier-living'), { recursive: true });
  writeFileSync(join(dist, 'ro.ciuntucbimstudio.mobilier-living', 'mobilier-living.lapinlib'), bytes);
  return stamp('ro.ciuntucbimstudio.mobilier-living', 'mobilier-living.lapinlib', bytes, FURNITURE.map((f) => f.name));
}

async function template(e) {
  await e.call('project.new', {});
  const snap = await e.call('doc.snapshot');
  const nodes = Array.isArray(snap.nodes) ? snap.nodes : Object.values(snap.nodes ?? {});
  const storeys = nodes.filter((x) => x.type === 'IfcBuildingStorey').sort((a, b) => (a.props?.elevation ?? 0) - (b.props?.elevation ?? 0));
  const names = ['Fundații', 'Parter', 'Etaj 1', 'Etaj 2'];
  for (let i = 0; i < storeys.length && i < names.length; i++) await e.execute('storey.update', { id: storeys[i].id, name: names[i] });
  const top = storeys[storeys.length - 1];
  await e.execute('storey.create', { name: 'Mansardă', elevation: (top?.props?.elevation ?? 3) + (top?.props?.height ?? 3), height: 2.8 });
  // What a Romanian permit's documents ask of a project, as project parameters (filled in per project).
  for (const [key, label, type] of [['regimInaltime', 'Regim de înălțime', 'text'], ['suprafataTeren', 'Suprafață teren (mp)', 'number'], ['pot', 'POT (%)', 'number'], ['cut', 'CUT', 'number'], ['categorieImportanta', 'Categoria de importanță', 'text'], ['clasaImportanta', 'Clasa de importanță', 'text']])
    await e.execute('project.setParameter', { key, label, type, group: 'project', value: '' });
  const made = await e.call('template.make', {});
  const bytes = Buffer.from(made.data, 'base64');
  mkdirSync(join(dist, 'ro.ciuntucbimstudio.sablon-romania'), { recursive: true });
  writeFileSync(join(dist, 'ro.ciuntucbimstudio.sablon-romania', 'sablon-romania.lapin'), bytes);
  return stamp('ro.ciuntucbimstudio.sablon-romania', 'sablon-romania.lapin', bytes, ['Niveluri: Fundații, Parter, Etaj 1, Mansardă', 'Parametri: regim de înălțime, suprafață teren, POT, CUT, categoria și clasa de importanță']);
}

function script() {
  const from = join(root, 'examples', 'ro.ciuntucbimstudio.pereti-perimetrali', 'perimeter_walls.py');
  mkdirSync(join(dist, 'ro.ciuntucbimstudio.pereti-perimetrali'), { recursive: true });
  const to = join(dist, 'ro.ciuntucbimstudio.pereti-perimetrali', 'perimeter_walls.py');
  copyFileSync(from, to);
  return stamp('ro.ciuntucbimstudio.pereti-perimetrali', 'perimeter_walls.py', readFileSync(to));
}

const e = await startEngine(lapin);
try {
  const sums = [await furniture(e), await template(e), script()];
  writeFileSync(join(dist, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
  console.log(sums.join('\n'));
} finally { e.stop(); }
