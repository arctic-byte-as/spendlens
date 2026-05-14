import type { TextBlockParam } from '@anthropic-ai/sdk/resources/messages'

export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'

export function cachedSystemPrompt(text: string): TextBlockParam[] {
  return [{
    type: 'text',
    text,
    cache_control: { type: 'ephemeral' },
  }]
}
