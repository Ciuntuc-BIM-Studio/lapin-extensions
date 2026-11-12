// The store site's few behaviours: the list's search and kind filter, the theme toggle, copying an extension's id, the
// download count from the store's API. The pages read fine without it.
(function () {
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  // The theme: paper ↔ graphite, remembered on this device.
  var toggle = $('[data-theme-toggle]');
  if (toggle) toggle.addEventListener('click', function () {
    var root = document.documentElement;
    var dark = root.getAttribute('data-theme') ? root.getAttribute('data-theme') === 'graphite' : matchMedia('(prefers-color-scheme: dark)').matches;
    var next = dark ? 'paper' : 'graphite';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('lapin.store.theme', next); } catch (e) { /* this page only */ }
  });

  // The list: words typed and a kind chosen; ?kind= and ?q= in the address too.
  var search = $('[data-search]');
  var cards = $$('.cards .card');
  if (search) {
    var params = new URLSearchParams(location.search);
    var kind = params.get('kind') || '';
    search.value = params.get('q') || '';
    var count = $('[data-count]'), none = $('[data-none]');
    var apply = function () {
      var words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
      var shown = 0;
      cards.forEach(function (c) {
        var ok = (!kind || c.getAttribute('data-kind') === kind) && words.every(function (w) { return c.getAttribute('data-words').indexOf(w) >= 0; });
        c.hidden = !ok;
        if (ok) shown++;
      });
      $$('[data-filter-kind]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-filter-kind') === kind); });
      if (count) count.textContent = count.getAttribute('data-template').replace('{n}', String(shown));
      if (none) none.hidden = shown > 0 || !cards.length;
    };
    search.addEventListener('input', apply);
    $$('[data-filter-kind]').forEach(function (b) { b.addEventListener('click', function () { kind = b.getAttribute('data-filter-kind'); apply(); }); });
    apply();
  }

  // An extension's id copied, to paste in File → Extensions…'s search.
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(b.getAttribute('data-copy')) : Promise.reject()).then(function () {
        b.textContent = b.getAttribute('data-copied');
        setTimeout(function () { b.textContent = text; }, 1500);
      }, function () { /* the id is on the page to select */ });
    });
  });

  // Downloads, counted by the store (no personal data): /api/stats/<id> → { total, versions }.
  $$('[data-downloads]').forEach(function (el) {
    fetch(el.getAttribute('data-stats') + 'stats/' + encodeURIComponent(el.getAttribute('data-downloads')))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (s) { if (s && typeof s.total === 'number') el.textContent = s.total.toLocaleString(); })
      .catch(function () { /* the store's API is not reachable: the dash stays */ });
  });
})();
