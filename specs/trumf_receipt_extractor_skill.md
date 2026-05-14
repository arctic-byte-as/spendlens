# Skill: Extract Trumf Receipts to JSON

**Platform:** [trumf.no](https://www.trumf.no)
**Requires:** Active Trumf login session in browser
**Output:** One JSON file per receipt + one combined `all_receipts_trumf.json`

---

## Overview

This skill extracts all digital receipts available on your Trumf profile (last 12 months) and saves them as structured JSON files. The data includes every individual line item purchased, prices, quantities, VAT rates, and Trumf bonus percentages — useful for analysing shopping habits and health/spending patterns.

---

## Steps

### 1. Navigate to the Receipts Page

Go to: `https://www.trumf.no/profil/kvitteringer`

Confirm the page is loaded and the user is logged in (look for "Hei, [Name]" in the header).

---

### 2. Expand All Months

The receipt list groups transactions by month and collapses older months by default. Expand all months by clicking "Vis transaksjoner for [month]" for each collapsed section.

> **Automation note:** The site uses React (Next.js App Router). The toggle buttons respond to standard `MouseEvent` dispatched with `bubbles: true`. Use this loop:

```javascript
const clickAll = () => {
  const buttons = Array.from(document.querySelectorAll(
    '.ws-transaction-history-table__toggle-button'
  ));
  const collapsed = buttons.filter(b =>
    (b.getAttribute('aria-label') || '').startsWith('Vis ')
  );
  collapsed.forEach(btn => {
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  return collapsed.length;
};

// Repeat until no collapsed buttons remain
const loop = setInterval(() => {
  if (clickAll() === 0) clearInterval(loop);
}, 600);
```

Wait until the loop finds 0 collapsed buttons (typically ~20 seconds for 12 months).

---

### 3. Extract Transaction Metadata from React Fiber

With all rows visible, extract transaction IDs and metadata from the React component tree:

```javascript
const table = document.querySelector('.ws-transaction-history-table__table');
const tbody = table.querySelector('tbody');
const allRows = Array.from(tbody.querySelectorAll('tr'));
const transRows = allRows.filter(r => !r.className.includes('row--sum'));

const transactions = transRows.map(row => {
  const fiberKey = Object.keys(row).find(k => k.startsWith('__reactFiber'));
  if (!fiberKey) return null;
  let node = row[fiberKey];
  for (let i = 0; i < 5; i++) {
    if (node?.memoizedProps?.transaction) {
      const t = node.memoizedProps.transaction;
      return {
        batchId:   t.batchId,
        isoDate:   t.transaksjonsTidspunkt.toISOString(),
        store:     t.beskrivelse,
        amount:    t.belop,
        bonus:     t.bonus,
        chain:     t.partnerId,
        kategori:  t.transaksjonKategori,
        hasReceipt: t.harKvittering
      };
    }
    node = node?.return;
  }
  return null;
}).filter(t => t?.hasReceipt);

// Persist queue across navigations
localStorage.setItem('receiptQueue', JSON.stringify(transactions));
```

---

### 4. Fetch All Receipts via RSC Endpoint

The receipt detail pages are Next.js App Router pages that embed purchase data in their React Server Component (RSC) payload. They can be fetched directly — **no page navigation required**:

```javascript
function parseRSCReceipt(text) {
  const varelinjeIdx = text.indexOf('"varelinjer"');
  if (varelinjeIdx === -1) return null;
  const batchIdIdx = text.lastIndexOf('"batchId"', varelinjeIdx);
  const objStart = text.lastIndexOf('{', batchIdIdx);
  if (objStart === -1) return null;

  let depth = 0, end = objStart;
  for (let i = objStart; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) { end = i + 1; break; }
  }

  const clean = text
    .substring(objStart, end)
    .replace(/"\$D([^"]+)"/g, '"$1"')   // Deserialise Next.js Date markers
    .replace(/"\$undefined"/g, 'null');  // Deserialise undefined

  try { return JSON.parse(clean); } catch { return null; }
}

async function fetchReceipt(batchId) {
  const resp = await fetch(
    'https://www.trumf.no/profil/kvitteringer/' + batchId,
    { credentials: 'include', headers: { 'RSC': '1' } }
  );
  if (!resp.ok) return null;
  return parseRSCReceipt(await resp.text());
}
```

> **Key insight:** Adding the `RSC: 1` header tells Next.js to return the server component payload (a compact JSON-like format) instead of a full HTML page. The payload contains all receipt data including every `varelinje` (line item).

Fetch all receipts with concurrency control:

```javascript
(async () => {
  const queue = JSON.parse(localStorage.getItem('receiptQueue') || '[]');
  const results = [], errors = [];
  const BATCH = 5, DELAY = 500;

  for (let i = 0; i < queue.length; i += BATCH) {
    const batch = queue.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(async t => {
      try {
        const raw = await fetchReceipt(t.batchId);
        if (!raw) return { ok: false, batchId: t.batchId };
        return {
          ok: true,
          data: {
            receiptId:            raw.batchId,
            storeReceiptId:       raw.kvitteringsId,
            orderId:              raw.ordreId || null,
            totalAmount:          raw.belop,
            totalBonus:           raw.bonus,
            date:                 raw.transaksjonsTidspunkt,
            store:                raw.beskrivelse,
            chain:                raw.partnerId,
            bonusCalculationDate: raw.bonusberegningTidspunkt,
            items: raw.varelinjer.map(v => ({
              id:               v.varelinjeGuid,
              name:             v.produktBeskrivelse,
              quantity:         v.antall,
              unit:             v.enhetsType,
              totalPrice:       v.belop,
              bonus:            v.bonus,
              bonusPercent:     v.bonusProsent,
              vatPercent:       v.momsProsent,  // 15 = food, 25 = non-food
              isUnknownProduct: v.ukjentVare,
              savings:          (v.besparelser || []).map(s => ({
                description: s.besparelsesBeskrivelse,
                amount:      s.besparelse,
                campaignId:  s.kampanjeId
              }))
            })),
            vatSummary:      raw.momsreglerSum || [],
            savingsSummary:  raw.besparelserSum || 0
          }
        };
      } catch (e) {
        return { ok: false, batchId: t.batchId, error: e.message };
      }
    }));

    batchResults.forEach(r => r.ok ? results.push(r.data) : errors.push(r));
    localStorage.setItem('scrapingProgress',
      JSON.stringify({ done: i + batch.length, total: queue.length }));
    if (i + BATCH < queue.length)
      await new Promise(r => setTimeout(r, DELAY));
  }

  localStorage.setItem('allReceiptData', JSON.stringify(results));
  localStorage.setItem('receiptErrors',  JSON.stringify(errors));
  console.log('Done:', results.length, 'ok,', errors.length, 'errors');
})();
```

> **Note:** This call takes ~60–90 seconds for 254 receipts and will time out if awaited synchronously in a tool. Trigger it as a fire-and-forget async IIFE and poll `localStorage.getItem('scrapingProgress')` to track progress.

---

### 5. Download Individual JSON Files

```javascript
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: filename
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 100);
}

function getFilename(r) {
  const date  = r.date.substring(0, 10);
  const store = r.store.replace(/[^a-zA-Z0-9æøåÆØÅ]/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '');
  const id    = (r.receiptId || '').substring(0, 12);
  return `receipt_${date}_${store}_${id}.json`;
}

// Sequential download with 150 ms gap (avoids browser download throttling)
const allData = JSON.parse(localStorage.getItem('allReceiptData') || '[]');
let idx = 0;
const next = () => {
  if (idx >= allData.length) return;
  downloadJSON(allData[idx], getFilename(allData[idx]));
  idx++;
  setTimeout(next, 150);
};
next();
```

---

### 6. (Optional) Download Combined File with Summary

```javascript
const allData = JSON.parse(localStorage.getItem('allReceiptData') || '[]');

const byChain = {};
allData.forEach(r => {
  if (!byChain[r.chain]) byChain[r.chain] = { count: 0, spend: 0, bonus: 0 };
  byChain[r.chain].count++;
  byChain[r.chain].spend  += r.totalAmount;
  byChain[r.chain].bonus  += r.totalBonus;
});

const combined = {
  generatedAt: new Date().toISOString(),
  summary: {
    totalReceipts: allData.length,
    totalSpend:    allData.reduce((s, r) => s + r.totalAmount, 0),
    totalBonus:    allData.reduce((s, r) => s + r.totalBonus,  0),
    byChain
  },
  receipts: allData
};

downloadJSON(combined, 'all_receipts_trumf.json');
```

---

## JSON Schema

### Receipt object

```json
{
  "receiptId":            "2605130000047471...",
  "storeReceiptId":       "1391531",
  "orderId":              null,
  "totalAmount":          1759.32,
  "totalBonus":           59.93,
  "date":                 "2026-05-13T17:45:58.000Z",
  "store":                "KIWI Flaskebekk",
  "chain":                "KIWI",
  "bonusCalculationDate": "2026-05-13T00:00:00.000Z",
  "items": [
    {
      "id":               "0050568F74201...",
      "name":             "BURGER BIG PACK 4STK 600G FOLKETS",
      "quantity":         1,
      "unit":             "EA",
      "totalPrice":       79.90,
      "bonus":            0.80,
      "bonusPercent":     1,
      "vatPercent":       15,
      "isUnknownProduct": false,
      "savings":          []
    }
  ],
  "vatSummary":     [],
  "savingsSummary": 0
}
```

### Key field notes

| Field | Notes |
|-------|-------|
| `vatPercent` | `15` = food/groceries, `25` = non-food (Norwegian VAT rates) |
| `bonusPercent` | `15` = typically fresh produce/bakery, `1` = packaged goods |
| `unit` | `EA` = each/stk, `KGM` = per kg (weight items) |
| `savings` | Campaign/discount details if item was on offer |
| `chain` | `KIWI`, `MENY`, `JOK`, `SPAR`, `NORL`, `ESSO` |

---

## Implementation Notes

- **Auth:** The script relies on the browser's existing session cookies (`credentials: 'include'`). No credentials need to be captured or stored.
- **RSC token:** The `?_rsc=...` query parameter seen in browser network requests is a cache-busting nonce — it is **not required**. The `RSC: 1` header alone is sufficient.
- **Rate limiting:** 5 concurrent requests with 500 ms between batches has proven reliable. More aggressive fetching may trigger 429s.
- **Pagination:** The list page shows the last 12 months only. This appears to be a server-side limit, not a UI limit.
- **React version note:** The `__reactFiber` property prefix may change between React versions. If it fails, check `Object.keys(element)` for any key starting with `__react`.

---

## Potential Analysis Ideas

- **Spending trends** by month, chain, and category
- **Health index** — ratio of 15%-bonus items (fresh produce) vs. total basket
- **VAT split** — food (15% VAT) vs. non-food (25% VAT) share of spend
- **Price tracking** — track price changes for regularly purchased items over time
- **Savings rate** — identify which campaigns/offers you benefit from most
- **Wastage signals** — very small quantities of perishables might indicate shopping habits
