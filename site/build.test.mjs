// The store site built from an index into a temporary folder: npm test
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { authorSlug, buildSite, licenceMark, markdown } from './build.mjs';

const out = mkdtempSync(join(tmpdir(), 'lapin-store-site-'));
after(() => rmSync(out, { recursive: true, force: true }));

const base = (over) => ({
  schema: 1, version: '1.2.0', lapin: '>=0.1.900', languages: ['ro'],
  author: { name: 'Ciuntuc BIM Studio', github: 'Ciuntuc-BIM-Studio' },
  package: { url: 'https://example.org/a.lapinlib', sha256: 'b'.repeat(64), size: 2048, download: 'https://store.lapinbim.com/api/download/x/1.2.0' },
  ...over,
});
const index = {
  format: 'lapin-extensions-index', version: 1, extensions: [
    base({ id: 'ro.x.living', name: 'Living <script>alert(1)</script>', summary: 'Sofas & tables', kind: 'furniture', license: 'CC-BY-4.0', contents: { file: 'a.lapinlib', items: ['Sofa'] }, screenshots: ['https://example.org/shot.webp'], forum: 'https://forum.lapinbim.com/t/1' }),
    base({ id: 'ro.x.prices', name: 'Prețuri', summary: 'Indicative prices', kind: 'priceList', license: 'CC-BY-NC-4.0', indicative: true, contents: { file: 'p.lapinprices' }, author: { name: 'Ana Pop', forum: 'ana' } }),
    base({ id: 'ro.x.paid', name: 'Paid walls', summary: 'Sold', kind: 'types', license: 'LicenseRef-Ana-EULA', contents: { file: 't.lapintypes' }, author: { name: 'Ana Pop', forum: 'ana' },
      package: { url: 'https://store.lapinbim.com/api/licensed/ro.x.paid/1.2.0', sha256: 'c'.repeat(64), size: 900 },
      purchase: { provider: 'lemonsqueezy', productId: '42', checkoutUrl: 'https://ana.lemonsqueezy.com/buy/x', terms: 'https://ana.example/terms', price: '29 EUR' } }),
    base({ id: 'ro.x.walls', name: 'Walls script', summary: 'Four walls', kind: 'script', license: 'GPL-3.0-only', permissions: ['model.write'], contents: { file: 'w.py' } }),
  ],
};
buildSite({ index, out, history: false, store: 'https://store.lapinbim.com/api/' });
const read = (p) => readFileSync(join(out, p), 'utf8');

test('the list: every extension, the kinds as filters, the non-commercial one marked', () => {
  const html = read('index.html');
  for (const id of ['ro.x.living', 'ro.x.prices', 'ro.x.walls']) assert.ok(html.includes(`data-extension="${id}"`), id);
  assert.ok(html.includes('data-filter-kind="furniture"') && html.includes('data-filter-kind="script"'));
  assert.ok(!html.includes('data-filter-kind="hatches"'), 'a kind with nothing is not offered');
  assert.match(html, /data-extension="ro.x.prices"[\s\S]*?data-licence="nc"/);
});

test('a manifest\'s text is escaped everywhere', () => {
  for (const p of ['index.html', 'extension/ro.x.living/index.html', 'authors/ciuntuc-bim-studio/index.html']) {
    const html = read(p);
    assert.ok(!html.includes('<script>alert(1)'), p);
    assert.ok(html.includes('Living &lt;script&gt;'), p);
  }
});

test("an extension's page: licence, versions, size, SHA-256, author, forum, screenshots, how to install, downloads", () => {
  const html = read('extension/ro.x.living/index.html');
  assert.ok(html.includes('https://spdx.org/licenses/CC-BY-4.0.html'));
  assert.ok(html.includes('data-licence="permissive"'));
  assert.ok(html.includes('Lapin &gt;=0.1.900'));
  assert.ok(html.includes('2 KB'));
  assert.ok(html.includes('b'.repeat(64)));
  assert.ok(html.includes('href="/authors/ciuntuc-bim-studio/"'));
  assert.ok(html.includes('https://forum.lapinbim.com/t/1'));
  assert.ok(html.includes('<img src="https://example.org/shot.webp"'));
  assert.ok(html.includes('File → Extensions…, search “Living &lt;script&gt;alert(1)&lt;/script&gt;”'));
  assert.ok(html.includes('href="https://store.lapinbim.com/api/download/x/1.2.0"'));
  assert.ok(html.includes('data-downloads="ro.x.living" data-stats="https://store.lapinbim.com/api/"'));
  const prices = read('extension/ro.x.prices/index.html');
  assert.ok(prices.includes('data-licence="nc"') && prices.includes('indicative'));
  const script = read('extension/ro.x.walls/index.html');
  assert.ok(script.includes('data-licence="terms"') && script.includes('Change the open project'));
});

test('author pages, publishing, the legal drafts, the assets', () => {
  assert.ok(read('authors/index.html').includes('Ana Pop'));
  assert.ok(read('authors/ana/index.html').includes('https://forum.lapinbim.com/u/ana'));
  assert.ok(read('publish/index.html').includes('/dashboard/'));
  for (const f of ['terms-of-use', 'author-terms', 'privacy', 'notice-and-action']) assert.ok(existsSync(join(out, 'legal', `${f}.html`)), f);
  assert.ok(read('legal/privacy.html').includes('RO51725860'));
  for (const f of ['store.css', 'store.js', 'theme.js', 'icon.svg']) assert.ok(existsSync(join(out, 'assets', f)), f);
  assert.ok(existsSync(join(out, '404.html')));
});

test('the helpers', () => {
  assert.equal(authorSlug({ name: 'Ștefan Ăla' }), 'stefan-ala');
  assert.equal(authorSlug({ name: 'X', github: 'Octo-Cat' }), 'octo-cat');
  assert.equal(licenceMark('MIT OR CC-BY-NC-4.0'), 'permissive');
  assert.equal(licenceMark('CC-BY-NC-SA-4.0'), 'nc');
  assert.equal(licenceMark('LicenseRef-Firm'), 'terms');
  assert.equal(markdown('# T\n\nA **b** [c](https://x.ro) <i>\n\n- one\n- two'), '<h2>T</h2>\n<p>A <strong>b</strong> <a href="https://x.ro">c</a> &lt;i&gt;</p>\n<ul><li>one</li><li>two</li></ul>');
  assert.equal(markdown('[x](javascript:alert(1))'), '<p>[x](javascript:alert(1))</p>');
});

test('a paid extension: Paid and its price on its card; Buy at the seller\'s, sold by its author through its provider, their terms, no download', () => {
  assert.match(read('index.html'), /data-extension="ro.x.paid"[\s\S]*?data-paid[^>]*>Paid · 29 EUR/);
  assert.ok(!/data-extension="ro.x.living"[^]*?<\/a>/.exec(read('index.html'))[0].includes('data-paid'), 'a free one is not marked');
  const html = read('extension/ro.x.paid/index.html');
  assert.ok(html.includes('href="https://ana.lemonsqueezy.com/buy/x"') && html.includes('data-buy-link'));
  assert.ok(html.includes('Sold by Ana Pop through Lemon Squeezy.'));
  assert.ok(html.includes('href="https://ana.example/terms"'));
  assert.ok(html.includes('29 EUR, indicative'));
  assert.ok(!html.includes('data-download') && !html.includes('data-downloads='), 'no download, no public count');
  assert.ok(!html.includes('api/licensed'), 'the licensed address is Lapin\'s, not a link');
});
