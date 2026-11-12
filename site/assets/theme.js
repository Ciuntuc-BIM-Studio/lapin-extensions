// Before the page is drawn: the theme chosen on this device (paper or graphite), else the system's. No storage: no choice.
(function () {
  var chosen = null;
  try { chosen = localStorage.getItem('lapin.store.theme'); } catch (e) { /* private window */ }
  if (chosen === 'paper' || chosen === 'graphite') document.documentElement.setAttribute('data-theme', chosen);
})();
