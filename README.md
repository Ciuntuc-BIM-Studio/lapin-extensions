# Lapin Extensions

The free catalogue of extensions for [Lapin](https://github.com/Ciuntuc-BIM-Studio/lapin-pro), the open-source BIM modeller: furniture packs, project templates, types (walls, floors, doors, windows…), profile libraries, hatch patterns, title blocks and price lists made by Lapin's users, and Python scripts. In Lapin: **File → Extensions…**.

This repository holds one manifest per extension and the tools that check them and build the catalogue's index (served at `https://lapinbim.com/extensions/index.json`). The packages themselves live in their authors' GitHub releases; the manifest names each file and its SHA-256, and Lapin installs only that exact file.

## What can be published

| Kind (`kind`) | File | Where it goes in Lapin | Made with |
|---|---|---|---|
| `furniture` | `.lapinlib` | Interior → My furniture… | My furniture → Export |
| `template` | `.lapin` | File → New from template… | File → Save as template…, then Export |
| `types` | `.lapintypes` | the project open when it is installed (Installed → Add its types to this project, for another) | Manage → Type packs… → Export types… (wall, floor, door, window, column, beam, stair… types with their layers, materials, profiles and parameters) |
| `profiles` | `.lapinprofiles` | the profile libraries | Profile libraries → save a library to a folder |
| `hatches` | `.pat` | My patterns (Manage → Materials) | any AutoCAD-style `.pat` file |
| `titleBlock` | `.json` | the title blocks | Title blocks → Export |
| `priceList` | `.lapinprices` | Construction → Price lists… | Price lists… → a list on this computer → Export .lapinprices (`{"format": "lapin-price-list", "version": 1, "name", "currency", "indicative": true, "rows"}`) |
| `script` | `.py` | kept for Lapin's Python console | a Python file starting with `# lapin: name="…", version="…"` |

Content packs hold no code: Lapin reads them with its own importers and never runs anything. Scripts install on the desktop only, show what they ask for (`permissions`), and run once Lapin has its Python console, only when the user runs them.

## Publishing an extension

1. **Make the file** in Lapin (the table above) and try it: install it from a local catalogue (below).
2. **Release it** in a GitHub repository of yours: a release (tag like `my-pack-v1.0.0`) with the file attached. Copy the file's download address.
3. **Write its manifest**: fork this repository and add `extensions/<id>/manifest.json`. Start from one of the examples in `extensions/`. The `id` is lowercase with dots and dashes, starting with a domain of yours reversed or your GitHub name (`octocat.brick-hatches`), and is the folder's name. Fill in `package.size` and `package.sha256`:
   ```sh
   shasum -a 256 my-pack.lapinlib      # macOS, Linux (Windows: certutil -hashfile my-pack.lapinlib SHA256)
   ```
4. **Check it**: `node tools/validate.mjs --only <id>` (Node 22, nothing to install) downloads your file and checks it as the pull request will.
5. **Open a pull request.** One extension per pull request. The **Validate** check must pass.

To publish a new version: release the new file, raise `version` in the manifest (semver), update `package`, and open a pull request. Only the extension's author (`author.github`) or a maintainer may change it.

### The manifest

The full schema is [`schema/manifest.schema.json`](schema/manifest.schema.json). Required: `schema` (1), `id`, `name`, `summary`, `version`, `author.name`, `license`, `lapin`, `kind`, `contents.file`, `package` (`url`, `sha256`, `size`). Optional: `description`, `screenshots`, `author.github`/`url`/`forum`, `tags`, `languages`, `permissions` (scripts only), `requires`, `contents.items` (what it holds, shown before installing), `homepage`, `forum` (its topic on [forum.lapinbim.com](https://forum.lapinbim.com)), `indicative` (true, required for price lists).

`lapin` is the range of Lapin versions it works with: `>=0.1.860`, `>=0.1.860 <0.3.0`, `^0.1.900`, `*`. Lapin shows the extension to every version, and offers Install only to those in the range.

## Rules

- **A licence is required**: an [SPDX expression](https://spdx.org/licenses/) in `license` (`MIT`, `CC-BY-4.0`, `CC0-1.0`, `Apache-2.0 OR MIT`…). Lapin shows it before installing; permissive ones are marked so, the others say "read its terms". Any licence is accepted, `LicenseRef-…` too.
- **Non-commercial licences are accepted and marked.** An extension that can be taken only under a non-commercial licence (`CC-BY-NC-4.0`, `CC-BY-NC-SA-4.0`, `PolyForm-Noncommercial-1.0.0`, a `LicenseRef-…NonCommercial`) is shown as **Non-commercial** in Browse and its details, and `validate.mjs` prints it so; `MIT OR CC-BY-NC-4.0` can be taken under MIT and is not.
- **Only what you may share.** Your own work, or work whose licence lets you redistribute it, credited as it asks. No models, textures or images taken from other catalogues without their licence allowing it.
- **Prices and norms are indicative.** A price list says so (`indicative: true`), and Lapin shows it as the author's indicative values.
- **No code in content packs.** A script is code: it is read by a reviewer before it is merged.
- **Nothing harmful**: no malware, no data collection a script does not declare (`permissions`), nothing illegal, nothing that misleads about what it is or who made it.
- **The file in the release does not change.** A new file is a new version. A file whose SHA-256 no longer matches fails the check and is not installed by Lapin.

## Review

- **Automatic** (every pull request, `.github/workflows/validate.yml`): the manifest against the schema, the file downloaded and its size and SHA-256 compared, the file checked as its kind's (a furniture library's items, a type pack's types, a `.pat` file's patterns, a price list's rows…), the catalogue's own rules tested (`npm test`), a changed extension's version raised, the author matching.
- **By hand**: a maintainer merges content packs that pass. A script is also read, line by line, by a reviewer (Claude) for what it does and whether it matches its declared permissions, and approved by the maintainer.
- **Removal**: an extension that breaks the rules, or one its author asks to remove, is taken out of the index. To report one, open an issue or write to hello@lapinbim.com (the procedure: `legal/notice-and-action.md`).

The catalogue is free; publishing and installing cost nothing. The catalogue is run by Ciuntuc BIM Studio SRL.

## A catalogue on your computer

```sh
node tools/make-examples.mjs --lapin ../lapin-pro   # the examples' files, built by a Lapin engine (pnpm setup in lapin-pro first)
node tools/validate.mjs --local                     # the manifests and dist/<id>/<file>
node tools/build-index.mjs --local                  # dist/index.json naming the files beside it
```

Then in Lapin: **File → Extensions… → Catalogue…** and the path of `dist/index.json` (or start Lapin's development build with `LAPIN_EXTENSIONS_INDEX=/path/to/dist/index.json pnpm dev`). A firm can keep its own catalogue the same way, in a shared folder.

## The store, store.lapinbim.com

The store is the catalogue's web face: a page per extension (description, screenshots, versions, licence, the Lapin versions it works with, size, SHA-256, author, homepage, forum topic, how to install it), author pages, and the author dashboard. Its pages are generated from this repository by `site/build.mjs` (Node, no dependencies; `npm run site` → `dist/site/`); the dashboard, the sign-in with a forum.lapinbim.com account, the submissions and the download counts are the store service's, in Lapin's repository (`deploy/store/`).

**Publishing through the store**: sign in at store.lapinbim.com with your forum account, fill in the form and upload the file. The store keeps the file at `https://store.lapinbim.com/packages/<id>/<version>/<file>` (that address goes in the manifest's `package.url`) and opens the pull request here for you, with `author.forum` set to your forum name; the same checks run on it. Only the forum account that first published an extension through the store can publish its new versions there.

**Screenshots**: up to six, listed in `screenshots`: files in the extension's folder (`screenshot.webp`, `screenshot-2.png`…, at most 2 MB each) or https addresses.

The legal drafts (terms of use, author terms, privacy notice, notice and action) are in `legal/` (English, with Romanian copies in `legal/ro/`), **drafts pending a lawyer's review**.

## Publishing the index (maintainers)

```sh
node tools/publish.mjs              # dist/publish/: the index (signed), its signature, the package copies, the store's pages
node tools/publish.mjs --upload     # the same, then rsync to the server (DEPLOY_SERVER in .env, see .env.example)
```

`publish.mjs` builds the index with each package named at its copy on lapinbim.com (`package.mirror`: `https://lapinbim.com/extensions/files/<id>/<version>/<file>`, which the browser edition reads) and at the store's counting address (`package.download`: `https://store.lapinbim.com/api/download/<id>/<version>`, which counts the download, without any personal data, and redirects to the copy). It downloads each package from its `url` and keeps it only when its size and SHA-256 are the manifest's.

**Signing.** The index is signed by the catalogue's own Ed25519 key, separate from the Lapin app updater's: each package gets `package.signature` (over its id, version, SHA-256 and size: `packageMessage` in `tools/lib.mjs`), and the index's exact bytes get `index.json.sig` (`{"format": "lapin-signature", "version": 1, "keyId", "value"}`). Lapin carries the public key and, from the build that carries it, refuses an unsigned or wrongly signed default catalogue; a catalogue of your own may be unsigned (Lapin warns). The key is made once by Lapin's `node scripts/store-key.mjs` (an encrypted file, `~/.lapin/store-key.pem`, its password in the macOS keychain item `lapin-store-key`) and never leaves the maintainer's computer: signing happens there, in `publish.mjs`. `--unsigned` publishes before the key exists.

`node tools/build-index.mjs --mirror … --download …` alone writes the same index unsigned, in `index.json`.

## Licence

The tooling and documents of this repository are MIT ([LICENSE](LICENSE)). Each extension is under its own licence, named in its manifest.
