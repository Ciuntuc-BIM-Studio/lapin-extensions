// The index built from manifests (catalogue.mjs), a paid extension's kept without any public copy: npm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildIndex } from './catalogue.mjs';
import { checkPackage, isPaid, sha256, validateManifest } from './lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const example = join(root, 'examples', 'paid', 'example.paid-hatches');
const paid = JSON.parse(readFileSync(join(example, 'manifest.json'), 'utf8'));
const free = JSON.parse(readFileSync(join(root, 'extensions', 'ro.ciuntucbimstudio.mobilier-living', 'manifest.json'), 'utf8'));

test('the example paid extension is a good manifest, its package the one it names', () => {
  assert.deepEqual(validateManifest(paid), []);
  assert.equal(isPaid(paid), true);
  const bytes = readFileSync(join(example, paid.contents.file));
  assert.equal(bytes.length, paid.package.size);
  assert.equal(sha256(bytes), paid.package.sha256);
  assert.deepEqual(checkPackage(paid.kind, bytes), ['BRICK-RO']);
});

test('the index names no copy and no counting address for a paid package; a free one gets both', () => {
  const index = buildIndex([free, paid], { mirror: 'https://lapinbim.com/extensions/files/', download: 'https://store.lapinbim.com/api/download/' });
  const [f, p] = index.extensions;
  assert.match(f.package.mirror, /^https:\/\/lapinbim.com\/extensions\/files\//);
  assert.match(f.package.download, /^https:\/\/store.lapinbim.com\/api\/download\//);
  assert.equal(p.package.mirror, undefined);
  assert.equal(p.package.download, undefined);
  assert.equal(p.package.url, 'https://store.lapinbim.com/api/licensed/example.paid-hatches/1.0.0');
  assert.deepEqual(p.purchase, paid.purchase);
});
