/* identity.js — YardiOne PARAMARK login + dashboard interactions */
(function () {
  'use strict';
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  document.addEventListener('DOMContentLoaded', function () {

    /* -------- LOGIN PAGE -------- */
    var passkey = $('#btn-passkey-login');
    var loginBtn = $('#loginbtn');
    var loginForm = $('.login-form form');
    function goDashboard() { window.location.href = '/dashboard.html'; }
    if (passkey) passkey.addEventListener('click', goDashboard);
    if (loginForm) loginForm.addEventListener('submit', function (e) { e.preventDefault(); goDashboard(); });
    if (loginBtn) loginBtn.addEventListener('click', function (e) { if (!loginForm) { e.preventDefault(); goDashboard(); } });

    // password show/hide
    var eye = $('#show_password');
    if (eye) eye.addEventListener('click', function () {
      var p = $('#txtPassword');
      if (!p) return;
      var show = p.type === 'password';
      p.type = show ? 'text' : 'password';
      eye.classList.toggle('fa-eye-slash', !show);
      eye.classList.toggle('fa-eye', show);
    });

    /* -------- DASHBOARD -------- */
    // dark mode
    var dm = $('#darkModeToggle');
    if (dm) dm.addEventListener('change', function () { document.body.classList.toggle('yo-dark', dm.checked); });

    // sort pills (A-Z / Z-A / recent)
    var pills = $$('.appOrderFilter');
    var appsContainer = $('#tenant_apps');
    function sortApps(order) {
      if (!appsContainer) return;
      var items = $$('div[name="app"]', appsContainer);
      items.sort(function (a, b) {
        var x = (a.getAttribute('data-title') || '').toLowerCase();
        var y = (b.getAttribute('data-title') || '').toLowerCase();
        return order === '1' ? (y < x ? -1 : 1) : (x < y ? -1 : 1);
      });
      items.forEach(function (i) { appsContainer.appendChild(i); });
    }
    pills.forEach(function (p) {
      p.addEventListener('click', function () {
        pills.forEach(function (q) { q.classList.remove('pill-active'); });
        p.classList.add('pill-active');
        sortApps(p.value);
      });
    });

    // live search filter
    var search = $('#dashboard_search input.search-query');
    if (search) search.addEventListener('keyup', function () {
      var s = search.value.toLowerCase();
      $$('#tenant_apps div[name="app"]').forEach(function (b) {
        var t = (b.getAttribute('data-title') || '').toLowerCase();
        b.style.display = (!s || t.indexOf(s) > -1) ? '' : 'none';
      });
    });

    // notifications sidebar toggle
    var nMenu = $('#notification-menu'), closeN = $('#close-announcement');
    if (nMenu) nMenu.addEventListener('click', function () { var rc = $('.right-content'); if (rc) rc.classList.add('show-notification'); });
    if (closeN) closeN.addEventListener('click', function () { var rc = $('.right-content'); if (rc) rc.classList.remove('show-notification'); });

    // mobile sidebar toggle
    var bt = $('#btn-toggle'), btc = $('#btn-toggle-close'), sb = $('.sidebar');
    if (bt && sb) bt.addEventListener('click', function () { sb.classList.add('showMenu'); sb.classList.remove('d-none'); });
    if (btc && sb) btc.addEventListener('click', function () { sb.classList.remove('showMenu'); });
  });
})();
