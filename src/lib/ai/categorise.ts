import Anthropic from '@anthropic-ai/sdk'
import { CATEGORIES, type Category, isCanonicalCategory } from '@/lib/transactions/categories'
import { ANTHROPIC_MODEL, cachedSystemPrompt } from './model'

const BATCH_SIZE = 50

export interface TransactionInput {
  id: string
  description: string
  amount: number
}

export interface CategorisationResult {
  id: string
  category: string  // canonical Category OR a user-defined custom category name
  subcategory: string
  merchant: string
  is_recurring: boolean
  failed?: boolean
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

function normaliseCategory(cat: string, customCategories: string[]): string {
  const upper = cat.toUpperCase().trim()
  if (isCanonicalCategory(upper)) return upper
  if (customCategories.includes(upper)) return upper
  return 'OTHER'
}

async function categoriseBatch(
  batch: TransactionInput[],
  client: Anthropic,
  customCategories: string[]
): Promise<CategorisationResult[]> {
  const customSection = customCategories.length > 0
    ? `\n\nThe user has also defined these custom categories: ${customCategories.join(', ')}. Prefer these over OTHER when they are a clear fit.`
    : ''

  const systemPrompt = `You are a financial transaction categoriser. Analyse each transaction and assign exactly one category from this list: ${CATEGORIES.join(', ')}.${customSection}

Return ONLY a valid JSON array. Each element must have:
- "id": the transaction id (string, unchanged)
- "category": one of the categories above (string, uppercase)
- "subcategory": a more specific label (string, can be empty)
- "merchant": the merchant/payee name extracted from description (string)
- "is_recurring": whether this looks like a recurring payment (boolean)

No other text, no markdown, no explanation. Just the JSON array.`

  const message = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: cachedSystemPrompt(systemPrompt),
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
    category: normaliseCategory(r.category, customCategories),
  }))
}

export async function categoriseTransactions(
  transactions: TransactionInput[],
  customCategories: string[] = []
): Promise<CategorisationResult[]> {
  if (transactions.length === 0) return []

  const results: CategorisationResult[] = []
  for await (const batchResults of categoriseTransactionBatches(transactions, customCategories)) {
    results.push(...batchResults)
  }

  return results
}

export async function* categoriseTransactionBatches(
  transactions: TransactionInput[],
  customCategories: string[] = []
): AsyncGenerator<CategorisationResult[]> {
  if (transactions.length === 0) return

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const batches = chunk(transactions, BATCH_SIZE)

  for (let i = 0; i < batches.length; i++) {
    try {
      const batchResults = await categoriseBatch(batches[i], client, customCategories)
      yield batchResults
    } catch (error) {
      console.error(`Categorisation batch ${i} failed:`, error)
      // Preserve failed rows as uncategorised instead of pretending they are OTHER.
      yield batches[i].map(tx => ({
        id: tx.id,
        category: 'OTHER' as Category,
        subcategory: '',
        merchant: '',
        is_recurring: false,
        failed: true,
      }))
    }
  }
}
