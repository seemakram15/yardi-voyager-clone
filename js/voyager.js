/* =====================================================================
   voyager.js — client-side behaviour for the classic Voyager .aspx clones.
   Implements every function the inline DOM handlers reference, plus the
   live Bank-Reconcile math, grid switching, select-all and datepickers.
   ===================================================================== */
(function (w) {
  'use strict';

  /* ----- generic ASP.NET / YSI plumbing stubs (called inline) ----- */
  w.nameWindow = function (t) { try { document.title = t; } catch (e) {} };
  w.AutoSizeWindow = function () {};
  w.SetCaption = function () {};
  w.SetButtonStyles = function () {};
  w.ExitForm4ASPX = function () {};
  w.Hand = function (el) { if (el && el.style) el.style.cursor = 'pointer'; };
  w.gotChange2 = function () { return true; };
  w.SetModified = function () { return true; };
  w.ValidateDate2 = function () { return true; };
  w.ValidateCurrency2 = function () { return true; };
  w.FT_FinalTest = function () { return true; };
  w.FilterHelp4Aspx = function () { Voyager.toast('Help is not available in this demo.'); };
  w.Lookup2 = function () { Voyager.toast('Lookup is not available in this demo.'); };
  w.gridKeyDown = function () {};
  w.GridOnLoad = function () {};
  w.GridOnResize = function () {};
  w.attachEventHandler = function (obj, evt, fn) {
    if (!obj) return;
    var name = ('' + evt).replace(/^on/, '');
    if (obj.addEventListener) obj.addEventListener(name, fn, false);
    else if (obj.attachEvent) obj.attachEvent(evt, fn);
  };

  /* ----- helpers ----- */
  function parseAmt(s) {
    if (s == null) return 0;
    var n = parseFloat(('' + s).replace(/[, ]/g, '').replace(/[()]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  function fmt(n) {
    var neg = n < 0; n = Math.abs(n);
    var s = n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + s;
  }
  function $id(id) { return document.getElementById(id); }
  function setLabel(id, val) { var e = $id(id); if (e) e.textContent = fmt(val); }

  /* =====================================================================
     Bank Reconcile page
     ===================================================================== */
  var GRIDS = [
    { table: 'grdReconcile_DataTable',  cont: 'grdReconcile_DataGridContainer',  val: '2', cleared: 'ClearedDeposits_Label', transit: 'Deposits_Label' },
    { table: 'grdReconcile2_DataTable', cont: 'grdReconcile2_DataGridContainer', val: '1', cleared: 'ClearedChecks_Label',   transit: 'Checks_Label' },
    { table: 'grdReconcile3_DataTable', cont: 'grdReconcile3_DataGridContainer', val: '5', cleared: 'ClearedOther_Label',    transit: 'Other_Label' },
    { table: 'grdReconcile4_DataTable', cont: 'grdReconcile4_DataGridContainer', val: '3', cleared: 'BankRecItems_Label',    transit: 'Adj_Label' },
    { table: 'grdReconcile5_DataTable', cont: 'grdReconcile5_DataGridContainer', val: '4', cleared: 'BookRecItems_Label',    transit: null }
  ];
  var currentContainer = 'grdReconcile_DataGridContainer';

  function gridCheckboxes(tableId) {
    var t = $id(tableId);
    if (!t) return [];
    return Array.prototype.slice.call(t.querySelectorAll('input[type=checkbox][id$="_ClearedDisp_CheckBox"]'));
  }
  function amountFor(chk) {
    var amtEl = $id(chk.id.replace('_ClearedDisp_CheckBox', '_Amount'));
    return amtEl ? parseAmt(amtEl.value) : 0;
  }
  function dateFieldFor(chk) {
    return $id(chk.id.replace('_ClearedDisp_CheckBox', '_dtCleared'));
  }
  function closingDay() {
    var e = $id('ClosingDay_Label');
    return (e && e.textContent.trim()) || '05/31/2026';
  }

  function recalc() {
    if (!$id('grdReconcile_DataTable')) return; // not the bank-reconcile page
    var BankStmt = parseAmt((($id('BankStmt_Label') || {}).textContent) || '0');
    var GLBalance = parseAmt((($id('GLBalance_Label') || {}).textContent) || '0');

    var sums = {};
    GRIDS.forEach(function (g) {
      var total = 0, cleared = 0;
      gridCheckboxes(g.table).forEach(function (chk) {
        var a = amountFor(chk); total += a; if (chk.checked) cleared += a;
      });
      sums[g.val] = { total: total, cleared: cleared, uncleared: total - cleared };
      setLabel(g.cleared, cleared);
      if (g.transit) setLabel(g.transit, total - cleared);
    });

    var dit = sums['2'].uncleared;          // deposits in transit (uncleared)
    var oc = sums['1'].uncleared;           // outstanding checks (uncleared)
    var other = sums['5'].uncleared;        // +/- other items
    var bankRec = sums['3'].uncleared;      // +/- bank reconciling items
    var bookTotal = sums['4'].total;        // +/- book reconciling items (full)

    var stmtBal = BankStmt + dit - oc + other + bankRec;
    var glRec = GLBalance + bookTotal;
    setLabel('BookAdj_Label', bookTotal);
    setLabel('AdjBank_Label', glRec);
    setLabel('BankBal_Label', stmtBal);
    setLabel('Difference_Label', stmtBal - glRec);
  }
  w.recalc = recalc;

  w.SetClear = function (chk, type) {
    if (chk && chk.type === 'checkbox') {
      var d = dateFieldFor(chk);
      if (d) {
        if (chk.checked && !d.value) d.value = closingDay();
        else if (!chk.checked) d.value = '';
      }
    }
    recalc();
  };

  w.SelectAll = function (flag) {
    gridCheckboxes(($id(currentContainer) ?
      (currentContainer.replace('_DataGridContainer', '_DataTable')) :
      'grdReconcile_DataTable')).forEach(function (chk) {
      chk.checked = !!flag;
      var d = dateFieldFor(chk);
      if (d) d.value = flag ? closingDay() : '';
    });
    recalc();
  };

  w.showgrid = function (sel) {
    var v = sel.value;
    GRIDS.forEach(function (g) {
      var c = $id(g.cont);
      if (!c) return;
      if (g.val === v) { c.style.left = '10px'; currentContainer = g.cont; }
      else { c.style.left = '-1000px'; }
    });
  };

  w.showsrch = function (sel) {
    var v = sel.value;
    var num = $id('SrchNumber_TextBox');
    var dateDiv = $id('divSrchDate');
    var byDate = (v === '2' || v === '4');
    if (num) num.style.visibility = byDate ? 'hidden' : 'visible';
    if (dateDiv) dateDiv.style.visibility = byDate ? 'visible' : 'hidden';
  };

  w.show_calendar = function (id) {
    try { if (w.jQuery) jQuery('#' + id).datepicker('show'); } catch (e) {}
  };

  /* ----- __doPostBack: route the classic postbacks to friendly behaviour ----- */
  w.__doPostBack = function (target, arg) {
    switch (target) {
      case 'btnSubmit':            // BankRecFilter -> open reconcile screen
        window.location.href = 'BankReconcile.html';
        return;
      case 'btnClear':             // reset the filter
        var amt = $id('Amount_TextBox'); if (amt) amt.value = '5.00';
        Voyager.toast('Filter cleared.');
        return;
      case 'btnRefresh':
        Voyager.toast('Refreshed.');
        recalc();
        return;
      case 'btnPrint':
        window.print();
        return;
      case 'btnSave':
        Voyager.toast('Bank reconciliation saved.');
        return;
      case 'btnPost':
        Voyager.toast('Bank reconciliation posted.');
        return;
      case 'btnAdjust':
        Voyager.toast('Adjustment screen is not available in this demo.');
        return;
      default:
        return; // lookups, dropdown postbacks, etc.
    }
  };

  /* =====================================================================
     menu.aspx shell  (defined on parent; safe no-op elsewhere)
     ===================================================================== */
  w.doMenuClick = function (url) {
    var frame = $id('mainframe');
    if (!frame) {                       // we are inside the iframe -> bubble up
      if (w.parent && w.parent !== w && w.parent.doMenuClick) { w.parent.doMenuClick(url); }
      return;
    }
    var u = ('' + url).toLowerCase();
    if (u.indexOf('bankrecfilter') > -1) frame.src = 'BankRecFilter.html';
    else if (u.indexOf('bankreconcile') > -1) frame.src = 'BankReconcile.html';
    else {
      var title = url.split('/').pop().replace(/\.aspx.*$/i, '');
      frame.src = 'placeholder.html?t=' + encodeURIComponent(title);
    }
  };

  /* ----- quickmenu tile clicks ----- */
  w.goApp = function (view) {
    Voyager.toast('The "' + view + '" view is not part of this Voyager demo.\n' +
      'Open  G/L ▸ Banking ▸ Bank Functions ▸ Bank Reconcile  from the side menu.');
  };

  /* =====================================================================
     small UI helpers
     ===================================================================== */
  var Voyager = w.Voyager = {
    toast: function (msg) {
      var t = document.getElementById('voy-toast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'voy-toast';
        t.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);' +
          'background:#1c3f6e;color:#fff;padding:10px 18px;border-radius:4px;font:12px Verdana,sans-serif;' +
          'box-shadow:0 6px 20px rgba(0,0,0,.3);z-index:99999;max-width:520px;white-space:pre-line;text-align:center;';
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.opacity = '1';
      clearTimeout(t._h);
      t._h = setTimeout(function () { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, 3200);
    }
  };

  /* ----- on ready ----- */
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    // datepickers
    if (w.jQuery && jQuery.fn.datepicker) {
      try { jQuery('input.hasDatepicker, input[isday="true"]').datepicker({ dateFormat: 'mm/dd/yy', showOn: 'focus' }); } catch (e) {}
    }
    // horizontal header/data scroll sync for every ysi grid
    document.querySelectorAll('.ysi-grid-view').forEach(function (gv) {
      var data = gv.querySelector('.ysi-grid-dDiv');
      var head = gv.querySelector('.ysi-grid-hDiv');
      if (data && head) data.addEventListener('scroll', function () { head.scrollLeft = data.scrollLeft; });
    });
    // initial bank-reconcile totals
    recalc();
  });
})(window);
