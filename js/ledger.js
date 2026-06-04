/* =====================================================================
   ledger.js — upload a Yardi "Bank Reconciliation Report" PDF, parse it
   client-side (pdf.js), store it, and render it dynamically into every
   ledger-driven screen (Bank Reconcile + Bank Rec Filter).

   Sections mapped per the report:
     Outstanding Checks + Cleared Checks  -> Checks grid
     Cleared Deposits                      -> Deposits grid
     Cleared Other Items                   -> Other Items grid
   Field map:  Number<-Tran#/Check#  Date<-Date  Memo<-Notes/Payee  Amount<-Amount
   Rows are inserted UNCHECKED (data only).
   ===================================================================== */
(function (w) {
  'use strict';
  var KEY = 'yardiBankRecData';
  var CAL = '/65431weis/images/show_calendar.gif';
  var TYPE = { deposits: 2, checks: 1, other: 5 };

  /* ---------- helpers ---------- */
  function pad(d) {
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((d || '').trim());
    return m ? (('0' + m[1]).slice(-2) + '/' + ('0' + m[2]).slice(-2) + '/' + m[3]) : (d || '');
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var DATE = /^\d{1,2}\/\d{1,2}\/\d{4}$/, AMT = /^-?[\d,]+\.\d{2}$/;

  /* =====================================================================
     1) PARSE  (pdf.js)
     ===================================================================== */
  function parseFile(file) {
    if (!w.pdfjsLib) return Promise.reject(new Error('PDF engine not loaded.'));
    return file.arrayBuffer().then(function (buf) {
      return w.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    }).then(function (pdf) {
      var jobs = [];
      for (var p = 1; p <= pdf.numPages; p++) jobs.push(pdf.getPage(p).then(readPage));
      return Promise.all(jobs);
    }).then(function (pageLines) {
      var lines = [];
      pageLines.forEach(function (pl) { lines = lines.concat(pl); });
      return parseLines(lines);
    });
  }
  function readPage(page) {
    return page.getTextContent().then(function (tc) {
      var its = tc.items
        .filter(function (it) { return it.str && it.str.trim(); })
        .map(function (it) { return { x: it.transform[4], y: it.transform[5], str: it.str }; });
      its.sort(function (a, b) { return (b.y - a.y) || (a.x - b.x); });   // top->bottom, then left->right
      var lines = [], cur = null;
      its.forEach(function (it) {
        if (cur && Math.abs(it.y - cur.y) <= 3) cur.items.push(it);       // group a visual row (sub-pixel tolerant)
        else { cur = { y: it.y, items: [it] }; lines.push(cur); }
      });
      lines.forEach(function (l) { l.items.sort(function (a, b) { return a.x - b.x; }); });
      return lines;
    });
  }

  function parseLines(lines) {
    var data = { bankName: '', closingDay: '', glBalance: '', bankStmt: '', deposits: [], checks: [], other: [] };
    var section = null, cleared = false, notesX = null, m;
    var txt = function (l) { return l.items.map(function (i) { return i.str; }).join(' ').replace(/\s+/g, ' ').trim(); };

    for (var n = 0; n < lines.length; n++) {
      var l = lines[n], t = txt(l);

      // bank name = first name-like line near the top
      if (!data.bankName) {
        var cand = t.replace(/\s+\d{1,2}\/\d{1,2}\/\d{4}\s*$/, '').trim();
        if (/^[A-Za-z][A-Za-z .,'&\/()-]{4,}$/.test(cand) &&
            !/(Bank Reconciliation Report|Outstanding|Cleared|Posted by|Balance|Difference|Reconciled|Check|Amount|Notes|Payee|Tran|Date)/i.test(cand)) {
          data.bankName = cand;
        }
      }
      if (m = t.match(/Balance Per Bank Statement(?:\s+as of\s+(\d{1,2}\/\d{1,2}\/\d{4}))?.*?(-?[\d,]+\.\d{2})/i)) {
        if (m[1]) data.closingDay = pad(m[1]); data.bankStmt = m[2];
      }
      if (m = t.match(/Balance per GL(?:\s+as of\s+(\d{1,2}\/\d{1,2}\/\d{4}))?.*?(-?[\d,]+\.\d{2})/i)) {
        if (m[1] && !data.closingDay) data.closingDay = pad(m[1]); data.glBalance = m[2];
      }

      // section markers
      if (/^Outstanding Checks$/i.test(t)) { section = 'checks'; cleared = false; notesX = null; continue; }
      if (/^Cleared Checks$/i.test(t)) { section = 'checks'; cleared = true; notesX = null; continue; }
      if (/^Cleared Deposits$/i.test(t)) { section = 'deposits'; cleared = true; notesX = null; continue; }
      if (/^Cleared Other Items$/i.test(t)) { section = 'other'; cleared = true; notesX = null; continue; }
      if (/^(Total Cleared|Less:|Reconciled|Difference|Cleared Items|Balance per GL|Balance Per Bank)/i.test(t)) { section = null; continue; }

      // column header row -> capture Notes/Payee x (splits Tran# from Notes)
      if (/\b(Payee|Notes)\b/i.test(t) && /\bAmount\b/i.test(t)) {
        var ph = l.items.filter(function (i) { return /^(Payee|Notes)$/i.test(i.str); })[0];
        if (ph) notesX = ph.x;
        continue;
      }

      // data row
      if (section && l.items.length >= 3 && DATE.test(l.items[0].str)) {
        var rec = parseRow(l, notesX, cleared);
        if (rec && rec.amount) data[section].push(rec);
      }
    }
    return data;
  }

  function parseRow(l, notesX, cleared) {
    var items = l.items, end = items.length - 1, dateCleared = '';
    if (DATE.test(items[end].str)) { dateCleared = items[end].str; end--; }
    var ai = -1;
    for (var k = end; k >= 1; k--) { if (AMT.test(items[k].str)) { ai = k; break; } }
    if (ai < 0) return null;
    var amount = items[ai].str, tran = [], note = [];
    for (var j = 1; j < ai; j++) {
      var it = items[j];
      if (notesX != null) { (it.x >= notesX - 2 ? note : tran).push(it.str); }
      else { (j === 1 ? tran : note).push(it.str); }   // fallback: 1st token = Tran#
    }
    return {
      number: tran.join(' ').trim(),
      date: pad(items[0].str),
      memo: note.join(' ').trim(),
      amount: amount,
      cleared: !!cleared,
      dateCleared: pad(dateCleared)
    };
  }

  /* =====================================================================
     2) STORE
     ===================================================================== */
  function store(data) { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }

  /* =====================================================================
     3) RENDER  (Bank Reconcile grids + summary header)
     ===================================================================== */
  function rowHtml(gid, type, i, r) {
    var base = gid + '_DataTable_row' + i, nm = gid + ':DataTable:row' + i, sh = (i % 2 === 0);
    function hid(id, name, val) {
      return '<td width="0px" border="0px" style="display:none;"><input type="hidden" id="' + id + '" name="' + name + '" value="' + val + '"></td>';
    }
    return '<tr rownum="row' + i + '" id="' + base + '"' + (sh ? ' class="shadow"' : '') + ' valign="middle">' +
      hid(base + '_hTran', nm + ':hTran', '7' + gid.replace(/\D/g, '0') + ('0000' + i).slice(-4)) +
      '<td width="80px" style="text-align:Left;"><span id="' + base + '_Number" name="' + nm + ':Number" style="display:inline-block;vertical-align:top;">&nbsp;' + esc(r.number) + '</span></td>' +
      '<td width="85px" style="text-align:Left;"><span id="' + base + '_dtDate" name="' + nm + ':dtDate" style="display:inline-block;vertical-align:top;">&nbsp;' + esc(r.date) + '</span></td>' +
      '<td width="250px" style="text-align:Left;"><span id="' + base + '_Memo" name="' + nm + ':Memo" style="display:inline-block;vertical-align:top;">&nbsp;' + esc(r.memo) + '</span></td>' +
      '<td width="100px" style="text-align:Right;"><span id="' + base + '_AmountLabel" name="' + nm + ':AmountLabel" style="display:inline-block;vertical-align:top;">' + esc(r.amount) + '</span><input type="hidden" id="' + base + '_Amount" name="' + nm + ':Amount" value="' + esc(r.amount) + '"></td>' +
      hid(base + '_Cleared', nm + ':Cleared', '0') +
      '<td width="60px" style="text-align:center;"><input type="checkbox" id="' + base + '_ClearedDisp_CheckBox" name="' + nm + ':ClearedDisp:CheckBox" onclick="gotChange2(this);SetClear(this,' + type + ');"' + (sh ? ' class="Shadow"' : '') + '><input id="' + base + '_ClearedDisp_CheckBox_OrigValue" name="' + nm + ':ClearedDisp:CheckBox:OrigValue" type="hidden" value="False"></td>' +
      '<td width="95px"><input id="' + base + '_dtCleared" name="' + nm + ':dtCleared" isday="true" mandatory="false" class="Inp hasDatepicker" type="text" value="" origvalue="" onchange="gotChange2(this);SetModified(this,' + type + ');" onkeydown="gridKeyDown(event)" style="width:77px;z-index:9998;"><img src="' + CAL + '" onmouseover="Hand(this)" onclick="JavaScript:show_calendar(\'' + base + '_dtCleared\')" style="top:2px;left:2px;position:relative;"></td>' +
      hid(base + '_bChanged', nm + ':bChanged', '0') +
      hid(base + '_DataClassIndex', nm + ':DataClassIndex', String(i)) +
      '</tr>';
  }

  function buildGrid(gid, type, recs) {
    var table = document.getElementById(gid + '_DataTable');
    var div = document.getElementById(gid + '_DataDiv');
    if (!table) return;
    var tb = table.tBodies[0] || table.appendChild(document.createElement('tbody'));
    if (!recs || !recs.length) {
      tb.innerHTML = '<tr class="no-records"><td colspan="6" style="text-align:center;padding:10px 0;color:#8b8f94;font-style:italic;border:1px solid #d7dbdf;">No records to display.</td></tr>';
      if (div) div.style.height = '40px';
      return;
    }
    var html = '';
    for (var i = 0; i < recs.length; i++) html += rowHtml(gid, type, i, recs[i]);
    tb.innerHTML = html;
    if (div) div.style.height = Math.min(314, recs.length * 22 + 10) + 'px';
  }

  function setText(id, v) { var e = document.getElementById(id); if (e && v != null && v !== '') e.textContent = v; }

  function applyReconcile(d) {
    if (!document.getElementById('grdReconcile_DataTable')) return false;
    setText('BankName_Label', d.bankName);
    setText('ClosingDay_Label', d.closingDay);
    setText('GLBalance_Label', d.glBalance);
    setText('AdjBank_Label', d.glBalance);   // Reconciled G/L = GL + book(0); recalc refines
    setText('BankStmt_Label', d.bankStmt);
    buildGrid('grdReconcile', TYPE.deposits, d.deposits || []);
    buildGrid('grdReconcile2', TYPE.checks, d.checks || []);
    buildGrid('grdReconcile3', TYPE.other, d.other || []);
    if (w.jQuery && jQuery.fn.datepicker) {
      try { jQuery('input.hasDatepicker').datepicker({ dateFormat: 'mm/dd/yy', showOn: 'focus' }); } catch (e) {}
    }
    if (typeof w.recalc === 'function') w.recalc();
    return true;
  }

  function applyFilter(d) {
    var desc = document.getElementById('Bank_Description');
    if (!desc) return false;
    if (d.bankName) desc.textContent = d.bankName;
    var amt = document.getElementById('Amount_TextBox'); if (amt && d.bankStmt) amt.value = d.bankStmt;
    var close = document.getElementById('CloseDay_TextBox'); if (close && d.closingDay) close.value = d.closingDay;
    return true;
  }

  function applyAll() {
    var d = load(); if (!d) return;
    applyReconcile(d);
    applyFilter(d);
  }

  /* =====================================================================
     4) UPLOAD MODAL  (login screen)
     ===================================================================== */
  function initUploader() {
    var openBtn = document.getElementById('btnUploadLedger');
    var modal = document.getElementById('ledgerModal');
    if (!openBtn || !modal) return;
    if (w.pdfjsLib) w.pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.js';

    var fileInput = document.getElementById('ledgerFile');
    var statusEl = document.getElementById('ledgerStatus');
    var uploadBtn = document.getElementById('ledgerUploadBtn');
    function open() { modal.style.display = 'flex'; status('', ''); }
    function close() { modal.style.display = 'none'; }
    function status(msg, kind) {
      statusEl.textContent = msg || '';
      statusEl.className = 'ledger-status' + (kind ? ' ' + kind : '');
    }
    openBtn.addEventListener('click', open);
    var x = document.getElementById('ledgerClose'); if (x) x.addEventListener('click', close);
    var c = document.getElementById('ledgerCancelBtn'); if (c) c.addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });

    uploadBtn.addEventListener('click', function () {
      var f = fileInput && fileInput.files && fileInput.files[0];
      if (!f) { status('Please choose a PDF ledger file first.', 'err'); return; }
      status('Parsing "' + f.name + '"…', '');
      uploadBtn.disabled = true;
      parseFile(f).then(function (data) {
        var nd = (data.deposits || []).length, nc = (data.checks || []).length, no = (data.other || []).length;
        if (nd + nc + no === 0) throw new Error('No transactions found. Is this a Yardi Bank Reconciliation Report PDF?');
        store(data);
        status('Success — inserted ' + nc + ' checks, ' + nd + ' deposits, ' + no + ' other item' +
          (no === 1 ? '' : 's') + ' for "' + (data.bankName || 'bank account') + '". Click PROCEED to view.', 'ok');
      }).catch(function (err) {
        status('Could not read the file: ' + (err && err.message ? err.message : err), 'err');
      }).then(function () { uploadBtn.disabled = false; });
    });
  }

  /* =====================================================================
     5) public + autorun
     ===================================================================== */
  w.Ledger = { parseFile: parseFile, parseLines: parseLines, store: store, load: load, clear: clear,
               applyAll: applyAll, applyReconcile: applyReconcile, rowHtml: rowHtml };

  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    initUploader();                  // login screen
    applyAll();                      // bank reconcile / filter screens
    // live refresh if a new file is uploaded in another frame/tab
    w.addEventListener('storage', function (e) { if (e.key === KEY) applyAll(); });
  });
})(window);
