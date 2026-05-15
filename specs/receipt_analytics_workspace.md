# Receipt Analytics Workspace

**Status:** Draft spec  
**Created:** 2026-05-15  
**Related docs:** `specs/trumf_shopping_summary.md`, `specs/trumf_receipt_extractor_skill.md`, `docs/product-spec.md`, `docs/technical-spec.md`

---

## 1. Product Intent

SpendLens should grow from a bank CSV finance dashboard into a receipt-level analysis workspace for groceries and household spending.

The new workflow lets a user upload a `/receipts` folder exported from Trumf, stores the raw and normalised receipt documents in Supabase, and provides an interactive visual analysis surface for:

- cost over time
- products and product families
- healthy vs unhealthy choices
- fresh produce and high-bonus items
- chain, store, VAT, campaign, and bonus behaviour
- free-text questions answered by the AI endpoint
- reusable notebook-style analysis views similar to `specs/trumf_shopping_summary.md`

This should feel less like a static report and more like a personal grocery observatory: upload data once, then explore, ask questions, and save useful views.

---

## 2. Core User Flow

1. User opens `/receipts`.
2. User uploads either:
   - a folder of individual receipt JSON files, or
   - a combined `all_receipts_trumf.json`.
3. App validates the Trumf receipt schema locally and shows an import preview:
   - receipt count
   - date range
   - chains detected
   - total spend
   - total line items
   - duplicate receipts skipped
4. On confirm, app stores:
   - raw uploaded files in Supabase Storage
   - one document row per receipt in Postgres `jsonb`
   - normalised query rows for receipts and line items
5. App builds a first analysis notebook automatically:
   - summary metrics
   - spend by month
   - spend by chain
   - top products
   - fresh/high-bonus product view
   - VAT food vs non-food split
6. User explores the canvas workspace and asks free-text questions, for example:
   - "Which products are driving the biggest increase since January?"
   - "Show unhealthy snacks by month."
   - "What healthy items do I buy regularly?"
   - "Compare KIWI and MENY on price per basket."
   - "Which products should I reduce to save 1,000 kr per month?"
7. AI produces a structured analysis plan, runs allowed aggregate queries, and returns a visual or notebook block.
8. User can save any generated block into a notebook.

---

## 3. Experience Model

### Pages

```text
/receipts                 Receipt import and dataset overview
/receipts/[datasetId]     Visual canvas workspace
/receipts/[datasetId]/notebook
                          Notebook-style saved analysis
/receipts/[datasetId]/products
                          Product catalogue and health labels
```

### Visual Workspace

The canvas workspace should be an interactive analysis board, not a marketing-style page.

Recommended first version:

- left rail: saved views, filters, dataset selector
- main canvas: movable/resizable analysis blocks
- right panel: AI chat and block settings
- bottom strip: active filters and selected time range

Initial block types:

- KPI strip
- time-series chart
- ranked product table
- spend by chain chart
- food/non-food split
- health score trend
- product cluster map
- AI narrative block

For v1, this can be implemented with normal React layout and CSS grid. A true canvas library can wait until interactions require pan/zoom/free placement. If we do use a canvas-style library later, choose one that keeps text and controls accessible.

### Notebook Model

The notebook is a persisted sequence of analysis blocks. It is inspired by Jupyter, but should be simpler:

- Markdown note block
- SQL/aggregate query block
- chart block
- AI answer block
- table block
- saved prompt block

The notebook should be reproducible: each block stores its input query/prompt, filter state, generated output, and version metadata.

---

## 4. Data Strategy

Supabase is Postgres, not a document database, but `jsonb` gives us document-style storage while keeping relational query power. The recommended approach is hybrid:

- Store raw receipt documents in `jsonb` for fidelity and reprocessing.
- Store normalised receipt and line-item tables for fast analytics.
- Store AI/product classifications as separate versioned tables so labels can improve without mutating source data.

### Storage

Supabase Storage bucket:

```text
receipt-imports/{user_id}/{dataset_id}/raw/{filename}
receipt-imports/{user_id}/{dataset_id}/combined.json
```

### Tables

#### `receipt_datasets`

One import session or logical receipt collection.

```sql
id              uuid primary key default gen_random_uuid()
user_id         uuid references profiles(id) on delete cascade not null
source          text not null -- 'trumf'
name            text
uploaded_at     timestamptz default now()
period_start    date
period_end      date
receipt_count   int default 0
line_item_count int default 0
total_amount    numeric(12,2) default 0
status          text default 'processing'
storage_prefix  text
metadata         jsonb default '{}'
```

#### `receipt_documents`

Document-style canonical copy of each receipt.

```sql
id                uuid primary key default gen_random_uuid()
user_id           uuid references profiles(id) on delete cascade not null
dataset_id        uuid references receipt_datasets(id) on delete cascade not null
source            text not null -- 'trumf'
external_id       text not null -- Trumf batchId / receiptId
store_receipt_id  text
receipt_date      timestamptz
chain             text
store_name        text
total_amount      numeric(12,2)
total_bonus       numeric(12,2)
raw_document      jsonb not null
document_hash     text not null
created_at        timestamptz default now()
unique(user_id, source, external_id)
```

#### `receipt_line_items`

Normalised item-level analytics surface.

```sql
id                  uuid primary key default gen_random_uuid()
user_id             uuid references profiles(id) on delete cascade not null
dataset_id          uuid references receipt_datasets(id) on delete cascade not null
receipt_document_id uuid references receipt_documents(id) on delete cascade not null
source_item_id      text
receipt_date        date not null
chain               text
store_name          text
product_name_raw    text not null
product_key         text not null
quantity            numeric(12,3)
unit                text
total_price         numeric(12,2)
unit_price          numeric(12,4)
bonus               numeric(12,2)
bonus_percent       numeric(6,2)
vat_percent         numeric(6,2)
is_unknown_product  boolean default false
savings             jsonb default '[]'
```

#### `product_catalog`

User-scoped canonical products derived from receipt names.

```sql
id                  uuid primary key default gen_random_uuid()
user_id             uuid references profiles(id) on delete cascade not null
product_key         text not null
display_name        text not null
brand               text
package_size        text
category            text
subcategory         text
health_class        text -- 'healthy' | 'neutral' | 'unhealthy' | 'unknown'
health_confidence   numeric(4,3)
classification_json jsonb default '{}'
updated_at          timestamptz default now()
unique(user_id, product_key)
```

#### `analysis_notebooks`

```sql
id          uuid primary key default gen_random_uuid()
user_id     uuid references profiles(id) on delete cascade not null
dataset_id  uuid references receipt_datasets(id) on delete cascade
title       text not null
created_at  timestamptz default now()
updated_at  timestamptz default now()
```

#### `analysis_blocks`

```sql
id              uuid primary key default gen_random_uuid()
user_id         uuid references profiles(id) on delete cascade not null
notebook_id     uuid references analysis_notebooks(id) on delete cascade not null
position_index  int not null
block_type      text not null -- 'markdown' | 'query' | 'chart' | 'table' | 'ai_answer'
title           text
input_json      jsonb default '{}'
output_json     jsonb default '{}'
created_at      timestamptz default now()
updated_at      timestamptz default now()
```

#### `analysis_chat_messages`

```sql
id          uuid primary key default gen_random_uuid()
user_id     uuid references profiles(id) on delete cascade not null
dataset_id  uuid references receipt_datasets(id) on delete cascade not null
role        text not null -- 'user' | 'assistant' | 'tool'
content     text not null
metadata    jsonb default '{}'
created_at  timestamptz default now()
```

### RLS

All new tables must enable RLS with `user_id = auth.uid()`.

---

## 5. Ingestion Plan

### Accepted Inputs

The import UI should accept:

- `all_receipts_trumf.json`
- multiple `receipt_*.json` files
- a folder selected through browser directory upload

### Validation

Client-side validation should confirm:

- JSON is parseable
- each receipt has `receiptId` or `batchId`
- each receipt has `date`, `store`, `chain`, `totalAmount`, and `items`
- each item has `name`, `quantity`, `totalPrice`, `bonusPercent`, and `vatPercent`

Server-side validation must repeat the important checks.

### Dedupe

Use `unique(user_id, source, external_id)` and `document_hash`.

Import behaviour:

- duplicate external IDs are skipped by default
- changed hash for same external ID is flagged as a conflict
- user can reprocess a dataset without uploading again

### Product Key

Create a deterministic `product_key` from normalised product names:

- uppercase
- trim whitespace
- collapse repeated spaces
- remove obvious receipt noise
- preserve Norwegian characters

Later, AI can cluster similar names into canonical products, but deterministic keys should come first.

---

## 6. Health Classification

Health labels should start conservative. The app should be honest about uncertainty.

### First-Pass Signals

- high Trumf bonus percent can indicate fresh produce or campaign categories
- VAT 15% identifies food, not health
- product names reveal obvious classes:
  - likely healthy: cucumber, carrot, broccoli, berries, apples, bananas, salad
  - likely unhealthy: candy, chocolate, soda, chips, energy drink, biscuits
  - neutral: milk, eggs, bread, pasta, cheese, household staples

### AI Classification

Use AI to classify canonical products, not every line item.

Input:

```json
{
  "product_key": "SMÅGODT PR KG",
  "display_name": "SMÅGODT PR KG",
  "examples": ["SMÅGODT PR KG"],
  "spend": 5857,
  "quantity": 35.5
}
```

Output:

```json
{
  "category": "SNACKS & SWEETS",
  "subcategory": "CANDY",
  "health_class": "unhealthy",
  "confidence": 0.94,
  "rationale": "Bulk candy product name."
}
```

User corrections should override AI labels and be stored in `product_catalog`.

---

## 7. AI Chat Analysis

The chat endpoint should not hand raw SQL freedom directly to the model. Use a constrained analysis layer.

### Recommended Flow

1. User asks a question.
2. Server builds dataset context:
   - date range
   - receipt count
   - total spend
   - available dimensions
   - saved product health labels
3. AI chooses from allowed analysis intents:
   - `summary`
   - `trend`
   - `ranking`
   - `comparison`
   - `correlation`
   - `outlier`
   - `product_lookup`
4. Server executes typed aggregate functions.
5. AI explains the result and returns a block spec.

### Example Block Spec

```json
{
  "type": "chart",
  "title": "Unhealthy Snack Spend By Month",
  "visual": "line",
  "query": {
    "intent": "trend",
    "metric": "total_price",
    "dimension": "month",
    "filters": {
      "health_class": ["unhealthy"],
      "category": ["SNACKS & SWEETS"]
    }
  },
  "narrative": "Snack spend peaked in December and March."
}
```

### Privacy

Prefer aggregate data in AI prompts. Only include raw product names when needed for product classification or product-level questions.

---

## 8. Visualisation Approach

Start with SVG/HTML charts before adding heavy dependencies.

Recommended v1 visuals:

- CSS/SVG bar charts
- SVG line charts
- sortable tables
- heatmap grid for month x category
- scatterplot for product frequency vs spend

Potential later dependency:

- `@visx/*` for composable SVG visualisations
- avoid a full dashboarding framework until the interaction model is proven

Canvas-specific candidates:

- freeform board layout with React components first
- HTML canvas only for dense product maps or force layouts
- keep chart labels and tables in DOM for accessibility

---

## 9. MVP Scope

### MVP In

- Receipt upload page accepts combined JSON and folder upload.
- Supabase tables for datasets, documents, line items, product catalog, notebooks, blocks, and chat messages.
- Parser for Trumf receipt JSON shape defined in `specs/trumf_receipt_extractor_skill.md`.
- Dataset overview matching the existing `trumf_shopping_summary.md` metrics.
- Product catalogue with first-pass health labels.
- Static notebook generated after import.
- Chat endpoint that can answer aggregate questions using constrained analysis intents.
- Save AI answer as notebook block.

### MVP Out

- Automatic scraping from Trumf inside the app.
- Real-time collaborative notebooks.
- Arbitrary SQL execution by users or AI.
- Perfect nutrition scoring.
- Multi-source receipt ingestion beyond Trumf.
- Full Jupyter-style code execution.

---

## 10. Phased Plan

### Phase A: Spec And Data Foundation

- Finalise this spec.
- Add Supabase migrations for receipt datasets and documents.
- Add TypeScript types for Trumf receipts and normalised line items.
- Build deterministic product key normaliser.

### Phase B: Import Pipeline

- Add `/receipts` upload page.
- Accept combined JSON and folder uploads.
- Store raw files in Supabase Storage.
- Insert receipt documents and line items.
- Show import preview and duplicate handling.

### Phase C: Static Analytics

- Recreate `trumf_shopping_summary.md` as live UI.
- Add filters for date range, chain, product, VAT, and bonus percent.
- Add top products, monthly trend, chain comparison, and high-bonus views.

### Phase D: Product Health Layer

- Build product catalogue page.
- Add rule-based health pre-classification.
- Add AI classification for unknown canonical products.
- Add user correction UI.

### Phase E: Notebook Workspace

- Create default notebook after import.
- Persist analysis blocks.
- Add chart/table/markdown/AI answer block renderers.
- Let users save useful views.

### Phase F: AI Chat Analysis

- Add `/api/receipt-chat` endpoint.
- Implement typed aggregate analysis functions.
- Return block specs from AI.
- Store chat messages and generated blocks.

### Phase G: Canvas Workspace

- Add visual board layout over notebook blocks.
- Add drag, resize, duplicate, and pin controls.
- Add selected-block settings panel.

---

## 11. Open Questions

- Should receipt data integrate into the existing `transactions` dashboard as `GROCERIES`, or stay separate from bank CSV transactions?
- Should health classification be user-specific, household-specific, or global?
- How much manual product labelling is acceptable before AI classification kicks in?
- Do we want one notebook per dataset, or a long-lived notebook that can span multiple receipt imports?
- Should AI chat be Pro-gated separately from receipt import?
- Should product names be embedded for semantic search, or are aggregate queries enough for v1?

---

## 12. Backlog Seed

This spec should become a new backlog phase after the current CSV/AI dashboard work:

- Phase 7: Receipt Data Foundation
- Phase 8: Receipt Import And Summary
- Phase 9: Health Classification
- Phase 10: Notebook And Chat Analysis
- Phase 11: Canvas Workspace

Detailed user stories should be added to `docs/backlog.md` only after this spec is reviewed.
