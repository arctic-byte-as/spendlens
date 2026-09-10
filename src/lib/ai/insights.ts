import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_MODEL, cachedSystemPrompt } from './model'
import { logSecurityEvent } from '@/lib/logging/securityLog'

export interface SavingTip {
  category: string
  title: string
  saving_amount: number
  evidence: string
}

export async function generateInsights(
  categoryTotals: Record<string, number>
): Promise<SavingTip[]> {
  if (Object.keys(categoryTotals).length === 0) return []

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemPrompt = `You are a personal finance advisor. Based on spending category totals (in NOK), identify the top saving opportunities.

Return ONLY a valid JSON array of up to 5 saving tips, ordered by saving_amount descending. Each element must have:
- "category": the spending category (string)
- "title": a one-sentence actionable observation (string)
- "saving_amount": estimated NOK per month that could be saved (number)
- "evidence": brief explanation citing the spending data (string)

No other text, no markdown. Just the JSON array.`

  const message = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    system: cachedSystemPrompt(systemPrompt),
    messages: [{
      role: 'user',
      content: `Monthly spending by category (NOK): ${JSON.stringify(categoryTotals)}`,
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') return []

  try {
    const jsonMatch = content.text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []
    const tips: SavingTip[] = JSON.parse(jsonMatch[0])
    return tips.sort((a, b) => b.saving_amount - a.saving_amount).slice(0, 5)
  } catch {
    console.error('Failed to parse insights response')
    logSecurityEvent({
      eventType: 'ai_validation_failure',
      route: 'lib/ai/insights',
      actor: 'unknown',
      reason: 'insights_parse_failed',
    })
    return []
  }
}
