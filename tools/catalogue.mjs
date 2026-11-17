// The catalogue read from its folders: the manifests (extensions/<id>/manifest.json, each checked), the index built from
// them, and each extension's versions from git's history. Shared by build-index.mjs, publish.mjs and the store site
// (site/build.mjs). Node 22, no dependencies.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isPaid, validateManifest } from './lib.mjs';

/** Every manifest, by id; throws the first problem (a bad manifest stops a build). */
export function readManifests(root) {
  const dir = join(root, 'extensions');
  const out = [];
  for (const id of readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    const m = JSON.parse(readFileSync(join(dir, id, 'manifest.json'), 'utf8'));
    const errs = validateManifest(m);
    if (errs.length || m.id !== id) throw new Error(`${id}: ${errs[0] ?? `its folder is named ${id}, its id is ${m.id}`}`);
    out.push(m);
  }
  return out;
}

/**
 * The index of the manifests. `mirror`: each package also named at <mirror><id>/<version>/<file> (lapinbim.com's copy);
 * `download`: each package's counting address <download><id>/<version> (store.lapinbim.com's, which redirects to the
 * copy); `local`: the packages named by their paths in dist/ (a catalogue on this computer). A paid extension (stage 2a)
 * keeps its store address (it gives the file to a licence key only): no copy, no counting address.
 */
export function buildIndex(manifests, { local = false, mirror = null, download = null, root = '.', now = new Date() } = {}) {
  const slash = (u) => u.replace(/\/?$/, '/');
  const extensions = manifests.map((src) => {
    const m = structuredClone(src);
    if (local) {
      if (!existsSync(join(root, 'dist', m.id, m.contents.file))) throw new Error(`${m.id}: no dist/${m.id}/${m.contents.file}`);
      m.package = { ...m.package, url: `${m.id}/${m.contents.file}` };
      delete m.package.mirror;
      delete m.package.download;
      return m;
    }
    if (isPaid(m)) return m;
    if (mirror) m.package.mirror = `${slash(mirror)}${m.id}/${m.version}/${m.contents.file}`;
    if (download) m.package.download = `${slash(download)}${m.id}/${m.version}`;
    return m;
  });
  return { format: 'lapin-extensions-index', version: 1, generated: now.toISOString(), extensions };
}

/** An extension's versions as the catalogue's history has them, newest first: [{ version, date, lapin, sha256, size }]. */
export function versionsOf(root, id) {
  let log;
  try {
    log = execFileSync('git', ['log', '--format=%H %cI', '--', `extensions/${id}/manifest.json`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return []; }
  const seen = new Map();
  for (const line of log.split('\n').filter(Boolean)) {
    const [hash, date] = line.split(' ');
    let m;
    try { m = JSON.parse(execFileSync('git', ['show', `${hash}:extensions/${id}/manifest.json`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch { continue; }
    // The oldest commit of a version is when it was published: the log is newest first, so the last one seen stays.
    if (typeof m?.version === 'string') seen.set(m.version, { version: m.version, date, lapin: m.lapin, sha256: m.package?.sha256, size: m.package?.size });
  }
  return [...seen.values()];
}
