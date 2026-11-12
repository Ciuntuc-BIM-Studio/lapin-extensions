# Lapin Extensions

The free catalogue of extensions for [Lapin](https://github.com/Ciuntuc-BIM-Studio/lapin-pro), the open-source BIM modeller: furniture packs, project templates, profile libraries, hatch patterns, title blocks and price lists made by Lapin's users, and Python scripts. In Lapin: **File → Extensions…**.

This repository holds one manifest per extension and the tools that check them and build the catalogue's index (served at `https://lapinbim.com/extensions/index.json`). The packages themselves live in their authors' GitHub releases; the manifest names each file and its SHA-256, and Lapin installs only that exact file.

## What can be published

| Kind (`kind`) | File | Where it goes in Lapin | Made with |
|---|---|---|---|
| `furniture` | `.lapinlib` | Interior → My furniture… | My furniture → Export |
| `template` | `.lapin` | File → New from template… | File → Save as template…, then Export |
| `profiles` | `.lapinprofiles` | the profile libraries | Profile libraries → save a library to a folder |
| `hatches` | `.pat` | My patterns (Manage → Materials) | any AutoCAD-style `.pat` file |
| `titleBlock` | `.json` | the title blocks | Title blocks → Export |
| `priceList` | `.lapinprices` | Construction → Price lists… | `{"format": "lapin-price-list", "version": 1, "name", "currency", "indicative": true, "rows"}` |
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

The full schema is [`schema/manifest.schema.json`](schema/manifest.schema.json). Required: `schema` (1), `id`, `name`, `summary`, `version`, `author.name`, `license`, `lapin`, `kind`, `contents.file`, `package` (`url`, `sha256`, `size`). Optional: `description`, `author.github`/`url`, `tags`, `languages`, `permissions` (scripts only), `requires`, `contents.items` (what it holds, shown before installing), `homepage`, `forum` (its topic on [forum.lapinbim.com](https://forum.lapinbim.com)), `indicative` (true, required for price lists).

`lapin` is the range of Lapin versions it works with: `>=0.1.860`, `>=0.1.860 <0.3.0`, `^0.1.900`, `*`. Lapin shows the extension to every version, and offers Install only to those in the range.

## Rules

- **A licence is required**: an [SPDX expression](https://spdx.org/licenses/) in `license` (`MIT`, `CC-BY-4.0`, `CC0-1.0`, `Apache-2.0 OR MIT`…). Lapin shows it before installing; permissive ones are marked so, the others say "read its terms".
- **Only what you may share.** Your own work, or work whose licence lets you redistribute it, credited as it asks. No models, textures or images taken from other catalogues without their licence allowing it.
- **Prices and norms are indicative.** A price list says so (`indicative: true`), and Lapin shows it as the author's indicative values.
- **No code in content packs.** A script is code: it is read by a reviewer before it is merged.
- **Nothing harmful**: no malware, no data collection a script does not declare (`permissions`), nothing illegal, nothing that misleads about what it is or who made it.
- **The file in the release does not change.** A new file is a new version. A file whose SHA-256 no longer matches fails the check and is not installed by Lapin.

## Review

- **Automatic** (every pull request, `.github/workflows/validate.yml`): the manifest against the schema, the file downloaded and its size and SHA-256 compared, the file checked as its kind's (a furniture library's items, a `.pat` file's patterns, a price list's rows…), a changed extension's version raised, the author matching.
- **By hand**: a maintainer merges content packs that pass. A script is also read, line by line, by a reviewer (Claude) for what it does and whether it matches its declared permissions, and approved by the maintainer.
- **Removal**: an extension that breaks the rules, or one its author asks to remove, is taken out of the index. To report one, open an issue or write to ionut@ciuntucbimstudio.ro.

The catalogue is free; publishing and installing cost nothing. The catalogue is run by Ciuntuc BIM Studio SRL.

## A catalogue on your computer

```sh
node tools/make-examples.mjs --lapin ../lapin-pro   # the examples' files, built by a Lapin engine (pnpm setup in lapin-pro first)
node tools/validate.mjs --local                     # the manifests and dist/<id>/<file>
node tools/build-index.mjs --local                  # dist/index.json naming the files beside it
```

Then in Lapin: **File → Extensions… → Catalogue…** and the path of `dist/index.json` (or start Lapin's development build with `LAPIN_EXTENSIONS_INDEX=/path/to/dist/index.json pnpm dev`). A firm can keep its own catalogue the same way, in a shared folder.

## Publishing the index (maintainers)

```sh
node tools/build-index.mjs --mirror https://lapinbim.com/extensions/files/
```

writes `index.json`, each package also named at its copy on lapinbim.com (`<mirror><id>/<version>/<file>`), which the browser edition reads (GitHub's release files answer no browser). Copy `index.json` to `/extensions/index.json` and each package, after checking its SHA-256, to its copy's path.

## Licence

The tooling and documents of this repository are MIT ([LICENSE](LICENSE)). Each extension is under its own licence, named in its manifest.
