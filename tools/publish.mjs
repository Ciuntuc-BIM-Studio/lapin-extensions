#!/usr/bin/env node
// What lapinbim.com/extensions/ and store.lapinbim.com serve, built on the maintainer's computer (the store key never
// leaves it), into dist/publish/:
//   extensions/index.json        the index, each package named at its copy (--mirror) and its counting address
//                                (--download), each package's SHA-256 signed by the store key
//   extensions/index.json.sig    the index's own signature (lapin-signature v1)
//   extensions/files/<id>/<version>/<file>   the copies, each downloaded from its manifest's url and checked (size, SHA-256)
//   site/                        the store's pages (site/build.mjs) for that index
//   paid/<id>/<version>/<file>   paid packages (stage 2a) handed over privately, from private/ (git-ignored), checked;
//                                uploaded to <dir>/store-data/paid/, which the store serves only to a valid licence key
//                                (never under public/). A paid package the author uploaded to the store is already there.
//
//   node tools/publish.mjs                        signed with ~/.lapin/store-key.pem (its password: the keychain item
//                                                 lapin-store-key, or LAPIN_STORE_KEY_PASSWORD)
//   node tools/publish.mjs --key <file>           another key file
//   node tools/publish.mjs --unsigned             before the store key exists (Lapin accepts an unsigned default
//                                                 catalogue only while it carries no store key)
//   node tools/publish.mjs --upload               then copied to the server (rsync; DEPLOY_SERVER and DEPLOY_DIR from
//                                                 the environment or .env, git-ignored): <dir>/store-data/public/
// Files already copied (same SHA-256) are not downloaded again. Node 22, no dependencies (rsync for --upload).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from '../site/build.mjs';
import { buildIndex, readManifests } from './catalogue.mjs';
import { isPaid, MAX_PACKAGE, sha256 } from './lib.mjs';
import { DEFAULT_KEY, loadKeyFile, signIndex } from './sign.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const out = opt('--out', join(root, 'dist', 'publish'));
const mirror = opt('--mirror', 'https://lapinbim.com/extensions/files/');
const download = opt('--download', 'https://store.lapinbim.com/api/download/');
const unsigned = argv.includes('--unsigned');

const env = { ...process.env };
if (existsSync(join(root, '.env'))) for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
  const m = /^\s*([A-Z_]+)=(.*)$/.exec(line);
  if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim();
}

const die = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };

let index;
try { index = buildIndex(readManifests(root), { mirror, download }); } catch (e) { die(e.message); }

// The copies: each package checked before it is kept. A paid one gets no public copy: its file, when handed over privately
// (private/<id>/<version>/<file>), is checked and kept apart for the store's paid folder.
for (const m of index.extensions) {
  if (isPaid(m)) {
    const own = join(root, 'private', m.id, m.version, m.contents.file);
    if (!existsSync(own)) { console.log(`  paid ${m.id} ${m.version}: no private/ copy here (the store keeps the file its author uploaded)`); continue; }
    const bytes = readFileSync(own);
    if (bytes.length !== m.package.size || sha256(bytes) !== m.package.sha256) die(`${m.id}: private/${m.id}/${m.version}/${m.contents.file} is not the file its manifest names (size or SHA-256)`);
    const to = join(out, 'paid', m.id, m.version, m.contents.file);
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, bytes);
    console.log(`  paid ${m.id} ${m.version}: kept for the store's paid folder`);
    continue;
  }
  const path = join(out, 'extensions', 'files', m.id, m.version, m.contents.file);
  if (existsSync(path) && sha256(readFileSync(path)) === m.package.sha256) continue;
  const res = await fetch(m.package.url, { redirect: 'follow' }).catch((e) => die(`${m.id}: ${e.message}`));
  if (!res.ok) die(`${m.id}: ${m.package.url} answered ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_PACKAGE || bytes.length !== m.package.size) die(`${m.id}: the package is ${bytes.length} bytes, its manifest says ${m.package.size}`);
  if (sha256(bytes) !== m.package.sha256) die(`${m.id}: the package's SHA-256 is not its manifest's`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  console.log(`  copied ${m.id} ${m.version}`);
}

// The index, signed unless asked not to.
const indexPath = join(out, 'extensions', 'index.json');
mkdirSync(dirname(indexPath), { recursive: true });
if (unsigned) {
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
  rmSync(`${indexPath}.sig`, { force: true });
  console.log(`${index.extensions.length} extension(s), unsigned → ${indexPath}`);
} else {
  const keyFile = opt('--key', DEFAULT_KEY);
  if (!existsSync(keyFile)) die(`no store key at ${keyFile} (lapin-pro: node scripts/store-key.mjs makes it; --unsigned before it exists)`);
  let key;
  try { key = loadKeyFile(keyFile); } catch (e) { die(`the store key could not be read (${e.message}): its password is the keychain item lapin-store-key, or LAPIN_STORE_KEY_PASSWORD`); }
  const signed = signIndex(index, key);
  index = signed.index;
  writeFileSync(indexPath, signed.text);
  writeFileSync(`${indexPath}.sig`, signed.sig);
  console.log(`${index.extensions.length} extension(s), signed by key ${JSON.parse(signed.sig).keyId} → ${indexPath}`);
}

// The store's pages.
rmSync(join(out, 'site'), { recursive: true, force: true });
buildSite({ index, root, out: join(out, 'site'), store: '/api/' });
console.log(`site → ${join(out, 'site')}`);

const server = env.DEPLOY_SERVER, dir = env.DEPLOY_DIR ?? '/opt/lapin';
const target = `${server ?? '<server>'}:${dir}/store-data/public/`;
if (argv.includes('--upload')) {
  if (!server) die('DEPLOY_SERVER is not set (.env, see .env.example)');
  // Files are never deleted on the server (old versions stay downloadable); the site is replaced whole.
  for (const [from, to, del] of [[join(out, 'extensions') + '/', `${target}extensions/`, false], [join(out, 'site') + '/', `${target}site/`, true]]) {
    // No --chmod: macOS's rsync (openrsync) refuses it; the modes and owner are set on the server below.
    const r = spawnSync('rsync', ['-rlt', ...(del ? ['--delete'] : []), from, to], { stdio: 'inherit' });
    if (r.status !== 0) die(`rsync to ${to} failed`);
  }
  // Paid packages to the store's own folder, outside public/: served to a valid licence key only.
  if (existsSync(join(out, 'paid'))) {
    const r = spawnSync('rsync', ['-rlt', join(out, 'paid') + '/', `${server}:${dir}/store-data/paid/`], { stdio: 'inherit' });
    if (r.status !== 0) die('rsync of the paid packages failed');
  }
  // The store container runs as 1000:1000 and reads only: directories 755, files 644.
  const pub = `${dir}/store-data/public`;
  const paid = `${dir}/store-data/paid`;
  const fix = spawnSync('ssh', ['-o', 'BatchMode=yes', server, `chown -R 1000:1000 '${pub}' && find '${pub}' -type d -exec chmod 755 {} + && find '${pub}' -type f -exec chmod 644 {} + && if [ -d '${paid}' ]; then chown -R 1000:1000 '${paid}' && find '${paid}' -type d -exec chmod 750 {} + && find '${paid}' -type f -exec chmod 640 {} +; fi`], { stdio: 'inherit' });
  if (fix.status !== 0) die(`setting the modes under ${pub} failed`);
  console.log(`uploaded to ${target}`);
} else {
  console.log(`To publish: node tools/publish.mjs --upload   (rsync to ${target})`);
}
