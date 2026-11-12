// The store key's signatures (Lapin decision 499, docs/plan-extensions.md §9.7 in lapin-pro): an Ed25519 key of its own,
// separate from the app updater's, kept off this repository (made by lapin-pro's scripts/store-key.mjs: an encrypted
// PKCS#8 file, its password in the macOS keychain item `lapin-store-key`). What is signed:
//   - each package in the index: package.signature = { keyId, value } over packageMessage(m) (lib.mjs): its id, version,
//     SHA-256 and size, so a manifest copied anywhere still names one exact file;
//   - the index itself: index.json.sig = { format: "lapin-signature", version: 1, keyId, value } over index.json's exact bytes.
// Lapin carries the public keys (ui/src/platform/extensions/keys.ts) and checks both. Node 22, no dependencies.
import { spawnSync } from 'node:child_process';
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { keyIdOf, packageMessage } from './lib.mjs';

export const DEFAULT_KEY = join(homedir(), '.lapin', 'store-key.pem');

/** The store key's password: LAPIN_STORE_KEY_PASSWORD, else the macOS keychain item lapin-store-key. Never printed. */
export function keyPassword(env = process.env) {
  if (env.LAPIN_STORE_KEY_PASSWORD) return env.LAPIN_STORE_KEY_PASSWORD;
  if (process.platform !== 'darwin') return undefined;
  const r = spawnSync('security', ['find-generic-password', '-s', 'lapin-store-key', '-a', 'lapin', '-w'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : undefined;
}

/** The private key from its PEM file (encrypted with `password`, or plain: a throwaway key in tests). */
export function loadKey(pem, password) {
  const key = createPrivateKey(password ? { key: pem, format: 'pem', passphrase: password } : { key: pem, format: 'pem' });
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('the store key is not an Ed25519 key');
  return key;
}

export const loadKeyFile = (path = DEFAULT_KEY, password = keyPassword()) => loadKey(readFileSync(path, 'utf8'), password);

/** A key's 32 raw public bytes. */
export const rawPublicKey = (key) => Buffer.from(createPublicKey(key).export({ format: 'jwk' }).x, 'base64url');

/** A signature by the key over bytes: { keyId, value }. */
export function signBytes(key, bytes) {
  return { keyId: keyIdOf(rawPublicKey(key)), value: sign(null, Buffer.from(bytes), key).toString('base64') };
}

/** Whether { keyId, value } is the signature of bytes by the public key given as 32 raw bytes. */
export function verifyBytes(raw, signature, bytes) {
  if (signature?.keyId !== keyIdOf(raw)) return false;
  const pub = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(raw).toString('base64url') }, format: 'jwk' });
  return verify(null, Buffer.from(bytes), pub, Buffer.from(signature.value, 'base64'));
}

/** The index signed: each package's signature added, then the text and its detached signature (index.json, index.json.sig). */
export function signIndex(index, key) {
  const signed = { ...index, extensions: index.extensions.map((m) => ({ ...m, package: { ...m.package, signature: signBytes(key, packageMessage(m)) } })) };
  const text = JSON.stringify(signed, null, 2) + '\n';
  const sig = { format: 'lapin-signature', version: 1, ...signBytes(key, Buffer.from(text, 'utf8')) };
  return { index: signed, text, sig: JSON.stringify(sig) + '\n' };
}
