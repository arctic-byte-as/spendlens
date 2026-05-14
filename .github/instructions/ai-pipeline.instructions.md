---
description: "Use when working on the Claude AI categorisation pipeline, the savings insight generation, or any code in src/lib/ai/."
applyTo: "src/lib/ai/**"
---

# AI Pipeline Guidelines

## Model
`claude-sonnet-4-20250514` via `@anthropic-ai/sdk`. Do not change the model without testing categorisation accuracy.

## Categorisation (`src/lib/ai/categorise.ts`)

### Batch size: 50 transactions
Do not change this without understanding the tradeoff — larger batches risk prompt truncation; smaller batches increase API cost.

```ts
const BATCH_SIZE = 50
const batches = chunk(transactions, BATCH_SIZE)
for (const batch of batches) {
  const result = await categoriseBatch(batch)
  // write results back
}
```

### Pre-flight sanitisation (client-side, before sending to server)
Strip account numbers and IBANs from transaction descriptions before they reach the API route. Pattern: `/\b[A-Z]{2}\d{2}[A-Z0-9]{4,}/g` (IBAN) and `/\b\d{11}\b/g` (Norwegian account number).

### Prompt structure
The system prompt defines the category taxonomy. The user message contains a JSON array of `{ id, description, amount }` objects. The model returns a JSON array of `{ id, category, subcategory, merchant, is_recurring }`.

Always use `response_format` structured output to prevent prose responses. Do not trust the model to return valid JSON without it.

### Category list (canonical, uppercase)
```
HOUSING | TRANSPORT | FOOD & DRINK | GROCERIES | HEALTH |
SUBSCRIPTIONS | SHOPPING | TRAVEL | SAVINGS & INVESTMENTS |
INCOME | CREDIT CARD | FEES | OTHER
```
If the AI returns a category not in this list, normalise to `OTHER` before writing to the DB.

### Error handling
- If a batch fails, log the batch index and mark `uploads.status = 'error'`
- Do not retry automatically — the user can re-trigger processing
- A 429 (rate limit) should surface as a user-visible message, not a silent failure

## Insights (`src/lib/ai/insights.ts`)

Savings insights are generated once per upload after categorisation is complete. The prompt receives aggregated category totals (not raw transactions) to minimise token usage.

Output schema per insight:
```ts
{
  category: string        // from canonical list
  title: string           // one-sentence observation
  saving_amount: number   // NOK/month estimate
  evidence: string        // supporting transactions cited
}
```

Insights are stored in `insights.top_saving_tips` as a `jsonb` array, ordered by `saving_amount` descending.

## Never in AI Prompts
- Raw account numbers or IBANs
- User email address or display name
- Any data from other users
- Supabase user UUIDs
