// The store key's signatures, with a throwaway key: npm test
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { keyIdOf, packageMessage, validateManifest } from './lib.mjs';
import { loadKey, rawPublicKey, signBytes, signIndex, verifyBytes } from './sign.mjs';

const { privateKey } = generateKeyPairSync('ed25519');
const manifest = {
  schema: 1, id: 'ro.x.hatches', name: 'Hatches', summary: 'Brick hatches.', version: '1.0.0', author: { name: 'X', forum: 'x_y.z' },
  license: 'MIT', lapin: '*', kind: 'hatches', contents: { file: 'b.pat' }, screenshots: ['screenshot.webp', 'https://example.org/2.png'],
  package: { url: 'https://example.org/b.pat', sha256: 'c'.repeat(64), size: 10, download: 'https://store.lapinbim.com/api/download/ro.x.hatches/1.0.0' },
};

test('the new manifest fields: screenshots, author.forum, package.download and signature', () => {
  assert.deepEqual(validateManifest(manifest), []);
  assert.ok(validateManifest({ ...manifest, screenshots: ['shot.gif'] })[0].startsWith('screenshots'));
  assert.ok(validateManifest({ ...manifest, screenshots: Array(7).fill('screenshot.png') })[0].startsWith('screenshots'));
  assert.ok(validateManifest({ ...manifest, author: { name: 'X', forum: 'a b' } })[0].startsWith('author.forum'));
  assert.ok(validateManifest({ ...manifest, package: { ...manifest.package, download: 'http://x' } })[0].startsWith('package.download'));
  assert.ok(validateManifest({ ...manifest, package: { ...manifest.package, signature: { keyId: 'x', value: 'y' } } })[0].startsWith('package.signature'));
});

test('a package signature names one exact file; a changed SHA-256, size or version breaks it', () => {
  const sig = signBytes(privateKey, packageMessage(manifest));
  const raw = rawPublicKey(privateKey);
  assert.equal(raw.length, 32);
  assert.equal(sig.keyId, keyIdOf(raw));
  assert.deepEqual(validateManifest({ ...manifest, package: { ...manifest.package, signature: sig } }), []);
  assert.equal(verifyBytes(raw, sig, packageMessage(manifest)), true);
  for (const p of [{ sha256: 'd'.repeat(64) }, { size: 11 }]) assert.equal(verifyBytes(raw, sig, packageMessage({ ...manifest, package: { ...manifest.package, ...p } })), false);
  assert.equal(verifyBytes(raw, sig, packageMessage({ ...manifest, version: '1.0.1' })), false);
  const other = rawPublicKey(generateKeyPairSync('ed25519').privateKey);
  assert.equal(verifyBytes(other, sig, packageMessage(manifest)), false, 'another key');
});

test('the index signed: each package, and the text by its detached signature', () => {
  const index = { format: 'lapin-extensions-index', version: 1, generated: '2026-11-12T00:00:00.000Z', extensions: [manifest] };
  const { text, sig, index: signed } = signIndex(index, privateKey);
  const raw = rawPublicKey(privateKey);
  const s = JSON.parse(sig);
  assert.equal(s.format, 'lapin-signature');
  assert.equal(verifyBytes(raw, s, Buffer.from(text)), true);
  assert.equal(verifyBytes(raw, s, Buffer.from(text.replace('Brick', 'Brick!'))), false);
  assert.equal(verifyBytes(raw, signed.extensions[0].package.signature, packageMessage(signed.extensions[0])), true);
});

test('the key read back from its encrypted file, with its password only', () => {
  const pem = privateKey.export({ format: 'pem', type: 'pkcs8', cipher: 'aes-256-cbc', passphrase: 'pw-123' });
  assert.deepEqual(rawPublicKey(loadKey(pem, 'pw-123')), rawPublicKey(privateKey));
  assert.throws(() => loadKey(pem, 'wrong'));
});
