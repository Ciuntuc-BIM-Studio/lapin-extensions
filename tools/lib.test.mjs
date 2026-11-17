// The catalogue's rules (lib.mjs), as Lapin has them (lapin-pro: ui/src/platform/extensions/*.test.ts). npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkPackage, isNonCommercial, isPaid, isPermissive, isSpdx, PAID_KINDS, validateManifest } from './lib.mjs';

const manifest = (over = {}) => ({
  schema: 1, id: 'ro.ciuntucbimstudio.pereti-ro', name: 'Pereți RO', summary: 'Wall types.', version: '1.0.0',
  author: { name: 'Ciuntuc BIM Studio', github: 'Ciuntuc-BIM-Studio' }, license: 'CC-BY-4.0', lapin: '>=0.1.900', kind: 'types',
  contents: { file: 'pereti-ro.lapintypes', items: ['WT1 BCA 30'] },
  package: { url: 'https://github.com/x/y/releases/download/v1/pereti-ro.lapintypes', sha256: 'a'.repeat(64), size: 100 },
  ...over,
});
const bytes = (v) => new TextEncoder().encode(JSON.stringify(v));
const pack = {
  format: 'lapin-type-pack', version: 1, name: 'Pereți RO',
  types: [{ ref: 'w1', class: 'IfcWallType', name: 'WT1 BCA 30', attrs: { mark: 'WT1' }, material: 's1' }],
  resources: [{ ref: 's1', class: 'IfcMaterialLayerSet', name: 'WT1 BCA 30', attrs: { layers: [{ material: 'm1', thickness: 0.3 }] } }, { ref: 'm1', class: 'IfcMaterial', name: 'BCA', attrs: {} }],
};

test('licences: any SPDX expression accepted, the non-commercial ones told apart', () => {
  assert.equal(isSpdx('CC-BY-NC-SA-4.0'), true);
  assert.deepEqual(validateManifest(manifest({ license: 'CC-BY-NC-4.0' })), []);
  for (const nc of ['CC-BY-NC-4.0', 'CC-BY-NC-ND-4.0', 'CC-BY-NC-SA-2.0-UK', 'PolyForm-Noncommercial-1.0.0', 'NCGL-UK-2.0', 'LicenseRef-Firm-NonCommercial', 'MIT AND CC-BY-NC-4.0']) assert.equal(isNonCommercial(nc), true, nc);
  for (const ok of ['MIT', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'NCSA', 'MIT OR CC-BY-NC-4.0', 'LicenseRef-Ciuntuc-1']) assert.equal(isNonCommercial(ok), false, ok);
  assert.equal(isPermissive('GPL-3.0-only OR MIT'), true);
  assert.equal(isPermissive('CC-BY-NC-4.0'), false);
});

test('the types kind: a .lapintypes', () => {
  assert.deepEqual(validateManifest(manifest()), []);
  assert.ok(validateManifest(manifest({ contents: { file: 'pereti.lapin' } })).includes('A types package is a .lapintypes file.'));
  assert.ok(validateManifest(manifest({ permissions: ['network'] })).includes('A content pack asks for no permission: it holds no code.'));
});

test('a type pack\'s file: its types, or why it is not one', () => {
  assert.deepEqual(checkPackage('types', bytes(pack)), ['WT1 BCA 30']);
  assert.throws(() => checkPackage('types', bytes({ ...pack, format: 'lapin-types' })), /not a Lapin type pack/);
  assert.throws(() => checkPackage('types', bytes({ ...pack, types: [] })), /no type/);
  assert.throws(() => checkPackage('types', bytes({ ...pack, types: [{ ...pack.types[0], class: 'IfcWall' }] })), /types only/);
  assert.throws(() => checkPackage('types', bytes({ ...pack, types: [{ ...pack.types[0], material: 'gone' }] })), /material is not in the pack/);
  assert.throws(() => checkPackage('types', bytes({ ...pack, resources: [...pack.resources, { ref: 'w1', class: 'IfcMaterial', name: 'X', attrs: {} }] })), /twice/);
  assert.throws(() => checkPackage('types', bytes({ ...pack, resources: [...pack.resources, { ref: 'st', class: 'IfcBuildingStorey', name: 'Parter', attrs: {} }] })), /spatial structure/);
});

test('the library kinds: each file as its library writes it', () => {
  const b = (o) => new TextEncoder().encode(typeof o === 'string' ? o : JSON.stringify(o));
  assert.deepEqual(checkPackage('symbols', b({ format: 'lapin-symbols', version: 1, symbols: [{ name: 'North', def: { items: [{ type: 'circle' }] } }] })), ['North']);
  assert.throws(() => checkPackage('symbols', b({ format: 'lapin-symbols', version: 1, symbols: [{ name: 'x', def: { items: [] } }] })), /draws nothing/);
  assert.deepEqual(checkPackage('lineTypes', b('*DASHDOT, a\nA,12,-6,0,-6\n')), ['DASHDOT']);
  assert.throws(() => checkPackage('lineTypes', b('*A\n*B\nA,1,-1\n')), /has no pattern/);
  assert.deepEqual(checkPackage('standards', b({ format: 'lapin-standards', version: 1, name: 'DIN', drafting: {} })), ['DIN']);
  assert.deepEqual(checkPackage('rules', b({ format: 'lapin-rules', version: 1, name: 'RO', indicative: true, stairs: {} })), ['RO']);
  assert.throws(() => checkPackage('rules', b({ format: 'lapin-rules', version: 1, name: 'RO', indicative: false, stairs: {} })), /indicative/);
  assert.deepEqual(checkPackage('barShapes', b({ format: 'lapin-bar-shapes', version: 1, shapes: [{ code: '21', label: 'L' }] })), ['21 L']);
  assert.deepEqual(checkPackage('parameters', b({ format: 'lapin-parameters', version: 1, parameters: [{ name: 'Fire', kind: 'text' }] })), ['Fire']);
  assert.deepEqual(checkPackage('mapping', b({ app: 'lapin', kind: 'layers', version: 1, layers: [{ layer: 'A-WALL' }] })), ['A-WALL']);
  assert.deepEqual(checkPackage('families', b({ format: 'lapin-family', version: 1, name: 'Bracket', def: {} })), ['Bracket']);
  assert.throws(() => checkPackage('families', b({ format: 'lapin-family', version: 1, name: 'x' })), /no definition/);
  assert.ok(validateManifest(manifest({ kind: 'rules', contents: { file: 'ro.lapinrules' } })).includes('A rule pack says its values are indicative: indicative must be true.'));
  assert.deepEqual(validateManifest(manifest({ kind: 'lineTypes', contents: { file: 'a.lin' } })), []);
});

test('a paid extension (stage 2a): its purchase, its package only through the store, the kinds that may be sold', () => {
  const paid = (over = {}, pkg = {}) => manifest({
    license: 'LicenseRef-Ana-EULA',
    purchase: { provider: 'gumroad', productId: '123456', checkoutUrl: 'https://ana.gumroad.com/l/abc', terms: 'https://ana.example/terms', price: '29 EUR' },
    package: { url: 'https://store.lapinbim.com/api/licensed/ro.ciuntucbimstudio.pereti-ro/1.0.0', sha256: 'a'.repeat(64), size: 100, ...pkg },
    ...over,
  });
  assert.deepEqual(validateManifest(paid()), []);
  assert.equal(isPaid(paid()), true);
  assert.equal(isPaid(manifest()), false);
  assert.deepEqual(validateManifest(paid({ purchase: { provider: 'gumroad', productId: '32-nPAicqbLj8B_WswVlMw==', checkoutUrl: 'https://ana.gumroad.com/l/walls', terms: 'https://ana.gumroad.com/terms' } })), []);
  const errs = (o) => validateManifest(o).join(' ');
  assert.match(errs(paid({ purchase: { provider: 'paddle', productId: '1', checkoutUrl: 'https://x.ro', terms: 'https://x.ro' } })), /purchase.provider must be one of gumroad/);
  assert.match(errs(paid({ purchase: { provider: 'lemonsqueezy', productId: '1', checkoutUrl: 'https://x.ro', terms: 'https://x.ro' } })), /purchase.provider must be one of gumroad/, 'Lemon Squeezy is closing: no longer accepted');
  assert.match(errs(paid({ purchase: { provider: 'gumroad', productId: 'a b', checkoutUrl: 'http://x.ro', terms: 'https://x.ro' } })), /productId[\s\S]*checkoutUrl must be an https/);
  assert.match(errs(paid({ purchase: { provider: 'gumroad', productId: 'p', checkoutUrl: 'https://x.ro' } })), /purchase.terms/);
  assert.match(errs(paid({ purchase: { provider: 'gumroad', productId: 'p', checkoutUrl: 'https://x.ro', terms: 'https://x.ro', price: 'x'.repeat(41) } })), /purchase.price/);
  assert.match(errs(paid({ purchase: 'yes' })), /purchase must be/);
  // No public copy: the store's licensed address for this id and version, no mirror, no counting address.
  assert.match(errs(paid({}, { url: 'https://github.com/a/b/releases/download/v1/x.lapintypes' })), /package.url must be https:\/\/store.lapinbim.com\/api\/licensed\/ro.ciuntucbimstudio.pereti-ro\/1.0.0/);
  assert.match(errs(paid({ version: '1.0.1' })), /api\/licensed\/ro.ciuntucbimstudio.pereti-ro\/1.0.1/);
  assert.match(errs(paid({}, { mirror: 'https://lapinbim.com/extensions/files/x' })), /no public copy/);
  assert.match(errs(paid({}, { download: 'https://store.lapinbim.com/api/download/x/1.0.0' })), /no public copy/);
  // Today every kind may be sold, scripts too; the list is explicit.
  assert.ok(PAID_KINDS.includes('script') && PAID_KINDS.includes('furniture'));
  assert.deepEqual(validateManifest(paid({ kind: 'script', contents: { file: 'walls.py' }, permissions: ['model.write'] })), []);
});
