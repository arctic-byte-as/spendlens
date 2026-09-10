// GENERATED FILE — do not edit directly.
// Source of truth: src/lib/receipts/bookmarklet.ts (BOOKMARKLET_SCRIPT_TEMPLATE).
// Regenerate with: npm run generate:bookmarklet
//
// This is the inspectable reference copy of the Trumf receipt import bookmarklet.
// __SPENDLENS_API_BASE__ and __IMPORT_TOKEN__ are substituted per-user at generation
// time by buildBookmarkletHref() — this file keeps the raw placeholders.

(function () {
  'use strict';

  var SPENDLENS_API_BASE = '__SPENDLENS_API_BASE__';
  var IMPORT_TOKEN = '__IMPORT_TOKEN__';
  var IMPORT_URL = SPENDLENS_API_BASE + '/api/receipts/import/bookmarklet';
  var MAX_FETCH_ATTEMPTS = 3;
  var RETRY_BASE_DELAY_MS = 1000;
  var FETCH_BATCH_SIZE = 5;
  var FETCH_BATCH_DELAY_MS = 500;

  var STATUS_ID = 'spendlens-trumf-import-status';

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function ensureStatusEl() {
    var existing = document.getElementById(STATUS_ID);
    if (existing) return existing;

    var el = document.createElement('div');
    el.id = STATUS_ID;
    el.style.cssText = [
      'position:fixed', 'bottom:16px', 'right:16px', 'z-index:2147483647',
      'background:#111827', 'color:#f9fafb', 'font-family:sans-serif',
      'font-size:13px', 'line-height:1.4', 'padding:12px 16px',
      'border-radius:8px', 'box-shadow:0 4px 16px rgba(0,0,0,0.3)',
      'max-width:320px', 'white-space:pre-line'
    ].join(';');
    document.body.appendChild(el);
    return el;
  }

  function setStatus(text) {
    ensureStatusEl().textContent = text;
  }

  function clickAllCollapsedMonths() {
    var buttons = Array.prototype.slice.call(
      document.querySelectorAll('.ws-transaction-history-table__toggle-button')
    );
    var collapsed = buttons.filter(function (b) {
      return (b.getAttribute('aria-label') || '').indexOf('Vis ') === 0;
    });
    collapsed.forEach(function (btn) {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    return collapsed.length;
  }

  function expandAllMonths() {
    setStatus('Expanding months...');
    return new Promise(function (resolve) {
      var loop = setInterval(function () {
        if (clickAllCollapsedMonths() === 0) {
          clearInterval(loop);
          setTimeout(resolve, 500);
        }
      }, 600);
    });
  }

  function extractTransactions() {
    setStatus('Reading transaction list...');
    var table = document.querySelector('.ws-transaction-history-table__table');
    if (!table) return [];
    var tbody = table.querySelector('tbody');
    if (!tbody) return [];
    var allRows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
    var transRows = allRows.filter(function (r) {
      return r.className.indexOf('row--sum') === -1;
    });

    return transRows.map(function (row) {
      var fiberKey = Object.keys(row).filter(function (k) {
        return k.indexOf('__reactFiber') === 0;
      })[0];
      if (!fiberKey) return null;
      var node = row[fiberKey];
      for (var i = 0; i < 5; i++) {
        if (node && node.memoizedProps && node.memoizedProps.transaction) {
          var t = node.memoizedProps.transaction;
          return { batchId: t.batchId, hasReceipt: t.harKvittering };
        }
        node = node ? node.return : null;
      }
      return null;
    }).filter(function (t) { return t && t.hasReceipt; });
  }

  function parseRSCReceipt(text) {
    var varelinjeIdx = text.indexOf('"varelinjer"');
    if (varelinjeIdx === -1) return null;
    var batchIdIdx = text.lastIndexOf('"batchId"', varelinjeIdx);
    var objStart = text.lastIndexOf('{', batchIdIdx);
    if (objStart === -1) return null;

    var depth = 0, end = objStart;
    for (var i = objStart; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) { end = i + 1; break; }
    }

    var clean = text
      .substring(objStart, end)
      .replace(/"\$D([^"]+)"/g, '"$1"')
      .replace(/"\$undefined"/g, 'null');

    try { return JSON.parse(clean); } catch (e) { return null; }
  }

  function fetchReceiptOnce(batchId) {
    return fetch('https://www.trumf.no/profil/kvitteringer/' + batchId, {
      credentials: 'include',
      headers: { 'RSC': '1' }
    }).then(function (resp) {
      if (!resp.ok) return null;
      return resp.text().then(parseRSCReceipt);
    });
  }

  function fetchReceiptWithRetry(batchId) {
    function attempt(n) {
      return fetchReceiptOnce(batchId).then(function (raw) {
        if (raw && raw.varelinjer) return raw;
        if (n >= MAX_FETCH_ATTEMPTS) return null;
        return sleep(RETRY_BASE_DELAY_MS * n).then(function () { return attempt(n + 1); });
      }).catch(function () {
        if (n >= MAX_FETCH_ATTEMPTS) return null;
        return sleep(RETRY_BASE_DELAY_MS * n).then(function () { return attempt(n + 1); });
      });
    }
    return attempt(1);
  }

  function toReceiptPayload(raw) {
    return {
      receiptId: raw.batchId,
      totalAmount: raw.belop,
      totalBonus: raw.bonus,
      date: raw.transaksjonsTidspunkt,
      store: raw.beskrivelse,
      chain: raw.partnerId,
      savingsSummary: raw.besparelserSum || 0,
      items: (raw.varelinjer || []).map(function (v) {
        return {
          id: v.varelinjeGuid,
          name: v.produktBeskrivelse,
          quantity: v.antall,
          unit: v.enhetsType,
          totalPrice: v.belop,
          bonus: v.bonus,
          bonusPercent: v.bonusProsent,
          vatPercent: v.momsProsent,
          isUnknownProduct: v.ukjentVare,
          savings: (v.besparelser || []).map(function (s) {
            return { amount: s.besparelse };
          })
        };
      })
    };
  }

  function fetchAllReceipts(queue) {
    var results = [];
    var failedBatchIds = [];
    var done = 0;

    function processBatch(start) {
      if (start >= queue.length) {
        return Promise.resolve();
      }
      var batch = queue.slice(start, start + FETCH_BATCH_SIZE);
      return Promise.all(batch.map(function (t) {
        return fetchReceiptWithRetry(t.batchId).then(function (raw) {
          done++;
          if (raw) {
            results.push(toReceiptPayload(raw));
          } else {
            failedBatchIds.push(t.batchId);
          }
          setStatus('Fetching receipts... ' + done + ' of ' + queue.length);
        });
      })).then(function () {
        if (start + FETCH_BATCH_SIZE < queue.length) {
          return sleep(FETCH_BATCH_DELAY_MS).then(function () { return processBatch(start + FETCH_BATCH_SIZE); });
        }
      });
    }

    return processBatch(0).then(function () {
      return { results: results, failedBatchIds: failedBatchIds };
    });
  }

  function importReceipts(receipts) {
    setStatus('Uploading ' + receipts.length + ' receipts to SpendLens...');
    return fetch(IMPORT_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + IMPORT_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ receipts: receipts })
    }).then(function (resp) {
      return resp.json().then(function (body) {
        return { ok: resp.ok, status: resp.status, body: body };
      });
    });
  }

  function finalStatus(fetchOutcome, importOutcome, totalQueued) {
    var lines = [];
    var fetchedCount = fetchOutcome.results.length;
    var failedCount = fetchOutcome.failedBatchIds.length;

    if (!importOutcome.ok) {
      lines.push('Import failed: ' + (importOutcome.body && importOutcome.body.error ? importOutcome.body.error : 'HTTP ' + importOutcome.status));
    } else {
      lines.push(importOutcome.body.imported + ' of ' + totalQueued + ' receipts imported');
      if (importOutcome.body.skipped) {
        lines.push(importOutcome.body.skipped + ' already imported (skipped)');
      }
    }

    if (failedCount > 0) {
      lines.push(failedCount + ' of ' + totalQueued + ' receipts could not be fetched from Trumf');
      lines.push('Failed batchIds: ' + fetchOutcome.failedBatchIds.slice(0, 5).join(', ') + (failedCount > 5 ? ', ...' : ''));
    }

    setStatus(lines.join('\n'));
  }

  expandAllMonths()
    .then(extractTransactions)
    .then(function (queue) {
      if (queue.length === 0) {
        setStatus('No receipts found on this page.');
        return;
      }
      return fetchAllReceipts(queue).then(function (fetchOutcome) {
        if (fetchOutcome.results.length === 0) {
          setStatus('0 of ' + queue.length + ' receipts could be fetched from Trumf.');
          return;
        }
        return importReceipts(fetchOutcome.results).then(function (importOutcome) {
          finalStatus(fetchOutcome, importOutcome, queue.length);
        });
      });
    })
    .catch(function (err) {
      setStatus('SpendLens import failed: ' + (err && err.message ? err.message : String(err)));
    });
})();
