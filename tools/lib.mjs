// The catalogue's rules, the same as Lapin's own (lapin-pro: ui/src/platform/extensions/manifest.ts and packs.ts): a
// manifest's schema, the Lapin versions it names, its licence, and each kind's package file. Node 22, no dependencies.
import { createHash } from 'node:crypto';

export const KINDS = {
  furniture: { ext: ['lapinlib'], code: false },
  template: { ext: ['lapin'], code: false },
  profiles: { ext: ['lapinprofiles'], code: false },
  hatches: { ext: ['pat'], code: false },
  titleBlock: { ext: ['json'], code: false },
  priceList: { ext: ['lapinprices'], code: false },
  script: { ext: ['py'], code: true },
};
export const PERMISSIONS = ['model.read', 'model.write', 'files.read', 'files.write', 'network', 'process'];
export const MAX_PACKAGE = 64 * 1024 * 1024;

const ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const SHA256 = /^[0-9a-f]{64}$/;
const SPDX_TOKEN = /^(?:[A-Za-z0-9][A-Za-z0-9.+-]*|LicenseRef-[A-Za-z0-9.-]+)$/;
const str = (v) => typeof v === 'string' && v.trim().length > 0;
const https = (u) => /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(u);

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Whether a text is an SPDX licence expression (its grammar). */
export function isSpdx(expr) {
  const tokens = String(expr).replace(/[()]/g, ' $& ').trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  let depth = 0, wantId = true;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '(') { if (!wantId) return false; depth++; continue; }
    if (t === ')') { if (wantId || --depth < 0) return false; continue; }
    if (t === 'AND' || t === 'OR') { if (wantId) return false; wantId = true; continue; }
    if (t === 'WITH') { if (wantId || !SPDX_TOKEN.test(tokens[i + 1] ?? '')) return false; i++; continue; }
    if (!wantId || !SPDX_TOKEN.test(t.replace(/\+$/, ''))) return false;
    wantId = false;
  }
  return depth === 0 && !wantId;
}

/** Whether a range of Lapin versions reads (>=0.1.860, >=0.1.860 <0.3.0, ^0.1.900, ~1.2.0, 0.1.x, *, ranges joined by ||). */
export function isRange(range) {
  if (!str(range)) return false;
  return range.split('||').every((part) => part.trim().split(/\s+/).filter(Boolean).every((w) => {
    if (w === '*' || w === 'x') return true;
    const m = /^(\^|~|>=|<=|>|<|=)?v?(.+)$/.exec(w);
    if (!m) return false;
    if (!m[1] && /^\d+(\.(\d+|x|\*))?(\.(x|\*))?$/.test(m[2])) return true;
    return SEMVER.test(m[2]);
  }));
}

/** What is wrong with a manifest, in sentences (none: it is good). `local`: package paths beside a local index allowed. */
export function validateManifest(o, { local = false } = {}) {
  const e = [];
  if (!o || typeof o !== 'object' || Array.isArray(o)) return ['The manifest is not a JSON object.'];
  if (o.schema !== 1) e.push('schema must be 1.');
  if (!str(o.id) || !ID.test(o.id) || o.id.length > 64) e.push('id must be lowercase letters and digits, joined by dots or dashes, at most 64 characters.');
  if (!str(o.name) || o.name.length > 80) e.push('name is required, at most 80 characters.');
  if (!str(o.summary) || o.summary.length > 200) e.push('summary is required, at most 200 characters.');
  if (o.description !== undefined && typeof o.description !== 'string') e.push('description must be text.');
  if (!str(o.version) || !SEMVER.test(o.version)) e.push('version must be a semantic version (1.0.0).');
  const a = o.author;
  if (!a || typeof a !== 'object' || !str(a.name)) e.push('author.name is required.');
  else {
    if (a.github !== undefined && (!str(a.github) || !/^[A-Za-z0-9-]{1,39}$/.test(a.github))) e.push('author.github must be a GitHub user name.');
    if (a.url !== undefined && (!str(a.url) || !https(a.url))) e.push('author.url must be an https address.');
  }
  if (!str(o.license)) e.push('license is required: an SPDX expression (MIT, CC-BY-4.0…).');
  else if (!isSpdx(o.license)) e.push(`license „${o.license}” is not an SPDX expression.`);
  if (!isRange(o.lapin)) e.push('lapin must be a range of Lapin versions (>=0.1.860).');
  const kind = KINDS[o.kind];
  if (!kind) e.push(`kind must be one of ${Object.keys(KINDS).join(', ')}.`);
  if (o.tags !== undefined && (!Array.isArray(o.tags) || o.tags.length > 12 || o.tags.some((t) => !str(t) || t.length > 30))) e.push('tags must be at most 12 short texts.');
  if (o.languages !== undefined && (!Array.isArray(o.languages) || o.languages.some((l) => typeof l !== 'string' || !/^[a-z]{2}$/.test(l)))) e.push('languages must be two-letter codes (ro, en).');
  if (o.permissions !== undefined && (!Array.isArray(o.permissions) || o.permissions.some((p) => !PERMISSIONS.includes(p)))) e.push(`permissions must be among ${PERMISSIONS.join(', ')}.`);
  if (kind && !kind.code && Array.isArray(o.permissions) && o.permissions.length) e.push('A content pack asks for no permission: it holds no code.');
  if (o.requires !== undefined && (!Array.isArray(o.requires) || o.requires.some((r) => !str(r) || !ID.test(r)))) e.push('requires must be module ids.');
  const c = o.contents;
  if (!c || typeof c !== 'object' || !str(c.file) || /[\\/]/.test(c.file)) e.push("contents.file is required: the package file's name.");
  else {
    if (kind && !kind.ext.some((x) => c.file.toLowerCase().endsWith(`.${x}`))) e.push(`A ${o.kind} package is a .${kind.ext.join(' or .')} file.`);
    if (c.items !== undefined && (!Array.isArray(c.items) || c.items.some((i) => typeof i !== 'string'))) e.push('contents.items must be a list of names.');
  }
  const p = o.package;
  if (!p || typeof p !== 'object') e.push('package is required: url, sha256 and size.');
  else {
    if (!str(p.url) || (!https(p.url) && !local)) e.push('package.url must be an https address (the release of the package).');
    if (!str(p.sha256) || !SHA256.test(p.sha256)) e.push("package.sha256 must be the file's SHA-256, 64 lowercase hex digits.");
    if (!Number.isInteger(p.size) || p.size <= 0 || p.size > MAX_PACKAGE) e.push(`package.size must be the file's size in bytes, at most ${MAX_PACKAGE}.`);
    if (p.mirror !== undefined && (!str(p.mirror) || !https(p.mirror))) e.push('package.mirror must be an https address.');
  }
  for (const k of ['homepage', 'forum']) if (o[k] !== undefined && (!str(o[k]) || !https(o[k]))) e.push(`${k} must be an https address.`);
  if (o.kind === 'priceList' && o.indicative !== true) e.push('A price list says its prices are indicative: indicative must be true.');
  if (o.indicative !== undefined && typeof o.indicative !== 'boolean') e.push('indicative must be true or false.');
  return e;
}

// ------------------------------------------------------------ the package files, by kind

const utf8 = (b) => { try { return new TextDecoder('utf-8', { fatal: true }).decode(b).replace(/^﻿/, ''); } catch { throw new Error('the file is not UTF-8 text'); } };
const json = (b) => { try { return JSON.parse(utf8(b)); } catch (x) { throw new Error(x.message.startsWith('the file') ? x.message : 'the file is not JSON'); } };

/** Checks a package's file for its kind; throws a sentence when it is not what Lapin takes. Returns what it holds. */
export function checkPackage(kind, bytes) {
  switch (kind) {
    case 'furniture': {
      const o = json(bytes);
      if (o.format !== 'lapin-furniture-library' || typeof o.version !== 'number' || o.version > 1) throw new Error('not a Lapin furniture library, version 1 (My furniture → Export)');
      if (!Array.isArray(o.items) || !o.items.length) throw new Error('the furniture library has no item');
      for (const it of o.items) if (!str(it?.name) || !str(it?.type?.class) || typeof it?.type?.spec !== 'object' || !str(it?.type?.spec?.kind)) throw new Error('an item has no name, type class or spec kind');
      return o.items.map((i) => i.name);
    }
    case 'template': {
      // A .lapin is a zip (format 3, docs/format-lapin.md in lapin-pro): its local file header first.
      if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) throw new Error('not a .lapin file (a zip)');
      return [];
    }
    case 'profiles': {
      const o = json(bytes);
      if (o.format !== 'lapin-profiles' || typeof o.version !== 'number' || o.version > 1) throw new Error('not a Lapin profile library, version 1');
      if (!str(o.name) || !Array.isArray(o.profiles) || !o.profiles.length) throw new Error('the profile library has no name or no profile');
      for (const p of o.profiles) if (!str(p?.name) || !str(p?.kind)) throw new Error('a profile has no name or kind');
      return o.profiles.map((p) => p.name);
    }
    case 'hatches': {
      const names = [];
      let lines = 0;
      for (const raw of utf8(bytes).split(/\r?\n/)) {
        const line = raw.replace(/;.*$/, '').trim();
        if (!line) continue;
        if (line.startsWith('*')) {
          if (names.length && !lines) throw new Error(`the pattern ${names.at(-1)} has no line`);
          const name = line.slice(1).split(',')[0].trim();
          if (!name) throw new Error('a pattern has no name');
          names.push(name.toUpperCase()); lines = 0;
        } else {
          if (!names.length) throw new Error('not a .pat file: it does not start with a *NAME line');
          if (!/^-?[\d.]+(\s*,\s*-?[\d.eE+-]+)+$/.test(line)) throw new Error(`a line of ${names.at(-1)} is not numbers`);
          lines++;
        }
      }
      if (!names.length || !lines) throw new Error('the file has no complete hatch pattern');
      return names;
    }
    case 'titleBlock': {
      const o = json(bytes);
      if ((o.format !== undefined && o.format !== 'lapin.titleBlock') || !str(o.name) || !Array.isArray(o.template?.items)) throw new Error('not a Lapin title block (Title blocks → Export)');
      return [o.name];
    }
    case 'priceList': {
      const o = json(bytes);
      if (o.format !== 'lapin-price-list' || typeof o.version !== 'number' || o.version > 1) throw new Error('not a Lapin price list, version 1');
      if (!str(o.name) || !/^[A-Z]{3}$/.test(o.currency ?? '')) throw new Error('the price list has no name or currency');
      if (o.indicative !== true) throw new Error('a price list says its prices are indicative (indicative: true)');
      if (!Array.isArray(o.rows) || !o.rows.length) throw new Error('the price list has no row');
      for (const r of o.rows) {
        if (!str(r?.c) || typeof r.n !== 'string' || typeof r.u !== 'string') throw new Error('a row has no code, description or unit');
        for (const k of ['m', 'l', 'e', 't', 'h', 'q']) if (r[k] !== undefined && !(typeof r[k] === 'number' && Number.isFinite(r[k]) && r[k] >= 0)) throw new Error(`the row ${r.c} has a price that is not a number`);
      }
      return [`${o.rows.length} rows`];
    }
    case 'script': {
      const text = utf8(bytes);
      if (text.includes('\0')) throw new Error('the script is not text');
      if (!/^# lapin:/m.test(text.split('\n').slice(0, 5).join('\n'))) throw new Error('a script starts with its header line: # lapin: name="…", version="…"');
      return [];
    }
    default: throw new Error(`no such kind: ${kind}`);
  }
}
