---
description: "Use when working on React components, the dashboard layout, the upload wizard, the transaction table, or any UI in src/app/ or src/components/."
applyTo: "src/**/*.tsx"
---

# Next.js Component Guidelines

## App Router Conventions
- Server Components by default — only add `"use client"` when you need browser APIs, event handlers, or React hooks (`useState`, `useEffect`, etc.)
- Data fetching happens in Server Components via the server-side Supabase client (`src/lib/supabase/server.ts`) — never fetch from a Client Component
- Page-level loading states use `loading.tsx` alongside the page file

## Styling
- Tailwind utility classes only — no inline `style` props, no CSS modules
- Use CSS variables from the design system: `var(--prancing-horse)`, `var(--luce-cream)`, etc.
- Uppercase all UI labels: `font-family: Orbitron; text-transform: uppercase; letter-spacing: 0.2em`
- Numbers right-aligned, monospaced (`font-family: 'DM Mono'`)

## Category Bars
No chart libraries. Render category bars as pure CSS:
```tsx
<div className="h-[6px] bg-[var(--cream-dark)] overflow-hidden">
  <div className="h-full bg-[var(--bronze)]" style={{ width: `${pct}%` }} />
</div>
```

## Currency Display
Always use the `currency` column from the transaction. Format: `47 320 NOK` (space as thousands separator, code after amount). Never hardcode `kr` or `$`.

```ts
function formatAmount(amount: number, currency: string) {
  return `${Math.abs(amount).toLocaleString('nb-NO')} ${currency}`;
}
```

## Transaction Sign Convention
- **Negative amount = debit (spending)** — display as `−2 840 NOK` in red/carbon
- **Positive amount = credit (income)** — display as `+62 400 NOK` in `var(--positive)`
- Never invert this convention

## The Upload Wizard
Three steps: Upload → Column Map → Confirm. Each step is a separate component. State is lifted to the parent `UploadWizard` component. Do not use URL state for wizard steps — keep it in React state.

## Inline Category Edit
Category corrections must write back to `transactions.category` via the `PATCH /api/transactions/[id]` route. Use optimistic UI — update the local state immediately, revert on error.

## Empty States
Every data-dependent view must have an empty state. The dashboard empty state prompts the user to upload their first CSV with a visible CTA button.
