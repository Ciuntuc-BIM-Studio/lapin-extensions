# A paid extension, as an example (not published)

`example.paid-hatches/` is a manifest of a **paid** extension (stage 2a: lapin-pro `docs/plan-extensions.md` §12) with its
package beside it. It lives here, outside `extensions/`, so the index, the store's pages and `tools/publish.mjs` never see
it; `tools/catalogue.test.mjs` reads it.

A paid extension differs from a free one in three things:

- `purchase`: `provider` (`lemonsqueezy` or `gumroad`), `productId` (the product's id at the provider), `checkoutUrl`
  (where it is bought), `terms` (the seller's terms of sale and refunds), and an optional `price`, shown as indicative.
- `package.url` is the store's licensed address, `https://store.lapinbim.com/api/licensed/<id>/<version>`: the store gives
  the file only to a licence key its provider says is valid. No `mirror`, no `download`: there is no public copy.
- The package is never in this repository. An author who submits through store.lapinbim.com uploads it there; one who opens
  a pull request sends it privately to hello@lapinbim.com, and the maintainer puts it in `private/<id>/<version>/<file>`
  (git-ignored), where `tools/validate.mjs` and `tools/publish.mjs` read it.

To try the whole flow on your own computer, see lapin-pro `deploy/store/README.md` → "Paid extensions".
