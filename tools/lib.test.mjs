// The catalogue's rules (lib.mjs), as Lapin has them (lapin-pro: ui/src/platform/extensions/*.test.ts). npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkPackage, isNonCommercial, isPermissive, isSpdx, validateManifest } from './lib.mjs';

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
