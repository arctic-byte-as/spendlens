import { isCanonicalCategory, type Category } from '@/lib/transactions/categories'

type PatchPayload = {
  category?: Category
  notes?: string | null
}

export function parseTransactionPatchPayload(payload: unknown): PatchPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid request body')
  }

  const body = payload as Record<string, unknown>
  const keys = Object.keys(body)
  const allowedKeys = new Set(['category', 'notes'])

  if (keys.length === 0 || keys.some(key => !allowedKeys.has(key))) {
    throw new Error('Only category and notes can be updated')
  }

  const output: PatchPayload = {}

  if ('category' in body) {
    if (typeof body.category !== 'string') {
      throw new Error('Invalid category')
    }
    const upper = body.category.toUpperCase().trim()
    if (!isCanonicalCategory(upper)) {
      throw new Error('Invalid category')
    }
    output.category = upper
  }

  if ('notes' in body) {
    if (body.notes !== null && typeof body.notes !== 'string') {
      throw new Error('Invalid notes')
    }
    output.notes = body.notes
  }

  if (!('category' in output) && !('notes' in output)) {
    throw new Error('No valid fields to update')
  }

  return output
}
