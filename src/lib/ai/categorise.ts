import Anthropic from '@anthropic-ai/sdk'

const BATCH_SIZE = 50

export const CATEGORIES = [
  'HOUSING', 'TRANSPORT', 'FOOD & DRINK', 'GROCERIES', 'HEALTH',
  'SUBSCRIPTIONS', 'SHOPPING', 'TRAVEL', 'SAVINGS & INVESTMENTS',
  'INCOME', 'FEES', 'OTHER'
] as const

export type Category = typeof CATEGORIES[number]

export interface TransactionInput {
  id: string
  description: string
  amount: number
}

export interface CategorisationResult {
  id: string
  category: Category
  subcategory: string
  merchant: string
  is_recurring: boolean
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

function normaliseCategory(cat: string): Category {
  const upper = cat.toUpperCase().trim()
  return (CATEGORIES as readonly string[]).includes(upper) ? upper as Category : 'OTHER'
}

async function categoriseBatch(
  batch: TransactionInput[],
  client: Anthropic
): Promise<CategorisationResult[]> {
  const systemPrompt = `You are a financial transaction categoriser. Analyse each transaction and assign exactly one category from this list: ${CATEGORIES.join(', ')}.

Return ONLY a valid JSON array. Each element must have:
- "id": the transaction id (string, unchanged)
- "category": one of the categories above (string, uppercase)
- "subcategory": a more specific label (string, can be empty)
- "merchant": the merchant/payee name extracted from description (string)
- "is_recurring": whether this looks like a recurring payment (boolean)

No other text, no markdown, no explanation. Just the JSON array.`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: JSON.stringify(batch.map(tx => ({
        id: tx.id,
        description: tx.description,
        amount: tx.amount,
      }))),
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

  let results: CategorisationResult[]
  try {
    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = content.text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array found in response')
    results = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error(`Failed to parse Claude response: ${content.text.substring(0, 200)}`)
  }

  // Normalise categories
  return results.map(r => ({
    ...r,
    category: normaliseCategory(r.category),
  }))
}

export async function categoriseTransactions(
  transactions: TransactionInput[]
): Promise<CategorisationResult[]> {
  if (transactions.length === 0) return []

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const batches = chunk(transactions, BATCH_SIZE)
  const results: CategorisationResult[] = []

  for (let i = 0; i < batches.length; i++) {
    try {
      const batchResults = await categoriseBatch(batches[i], client)
      results.push(...batchResults)
    } catch (error) {
      console.error(`Categorisation batch ${i} failed:`, error)
      // Add fallback 'OTHER' for failed batch
      for (const tx of batches[i]) {
        results.push({
          id: tx.id,
          category: 'OTHER',
          subcategory: '',
          merchant: '',
          is_recurring: false,
        })
      }
    }
  }

  return results
}
