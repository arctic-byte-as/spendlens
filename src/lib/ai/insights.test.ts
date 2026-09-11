const mockCreate = jest.fn()

jest.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }))
  return { __esModule: true, default: MockAnthropic, Anthropic: MockAnthropic }
})

import { receiptInsights, dietTrendInsights, type ReceiptInsightsInput } from './insights'
import type { MonthlyDietCategoryShare } from '@/lib/receipts/analysis'
import type { DietCategoryTarget } from '@/lib/receipts/dietTargets'

function textResponse(text: string) {
  return { content: [{ type: 'text', text }] }
}

const baseInput: ReceiptInsightsInput = {
  currency: 'NOK',
  healthRatio: 0.4,
  vatSplit: { foodSpend: 1000, nonFoodSpend: 200 },
  savingsRate: 0.1,
  chainBreakdown: [{ chain: 'KIWI', spend: 1000, trips: 10 }],
  topItems: [{ name: 'SMÅGODT', totalSpend: 500, totalQty: 20 }],
}

beforeEach(() => {
  mockCreate.mockReset()
})

describe('receiptInsights', () => {
  it('returns [] without calling the model when there is no aggregated data', async () => {
    const tips = await receiptInsights({ ...baseInput, chainBreakdown: [], topItems: [] })
    expect(tips).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('parses and tags valid model output with the receipt_analysis source', async () => {
    mockCreate.mockResolvedValue(
      textResponse(JSON.stringify([
        { category: 'Candy', title: 'Cut smågodt', saving_amount: 400, evidence: 'KIWI smågodt purchases' },
      ])),
    )

    const tips = await receiptInsights(baseInput)
    expect(tips).toEqual([
      { category: 'Candy', title: 'Cut smågodt', saving_amount: 400, evidence: 'KIWI smågodt purchases', source: 'receipt_analysis' },
    ])
  })

  it('drops malformed tip entries instead of throwing or returning garbage', async () => {
    mockCreate.mockResolvedValue(
      textResponse(JSON.stringify([
        { category: 'Candy', title: 'Cut smågodt', saving_amount: 400, evidence: 'ok' },
        { category: 'Bad', title: 'missing saving_amount', evidence: 'oops' },
        { category: 'Bad2', title: 123, saving_amount: 10, evidence: 'wrong type' },
      ])),
    )

    const tips = await receiptInsights(baseInput)
    expect(tips).toHaveLength(1)
    expect(tips[0].category).toBe('Candy')
  })

  it('returns [] on unparseable model output rather than throwing', async () => {
    mockCreate.mockResolvedValue(textResponse('not json at all'))
    const tips = await receiptInsights(baseInput)
    expect(tips).toEqual([])
  })

  it('returns [] when the model response is not an array', async () => {
    mockCreate.mockResolvedValue(textResponse(JSON.stringify({ oops: 'not an array' })))
    const tips = await receiptInsights(baseInput)
    expect(tips).toEqual([])
  })
})

describe('dietTrendInsights', () => {
  const targets: DietCategoryTarget[] = [
    { category: 'Candy & Sweets', direction: 'decrease', description: 'decrease candy' },
  ]

  const trend: MonthlyDietCategoryShare[] = [
    { month: '2026-01', category: 'Candy & Sweets', spend: 300, shareOfTotal: 0.3, shareDeltaVsPreviousMonth: null },
    { month: '2026-02', category: 'Candy & Sweets', spend: 100, shareOfTotal: 0.1, shareDeltaVsPreviousMonth: -0.2 },
  ]

  it('returns [] without calling the model when no category has 2+ months of data', async () => {
    const singleMonth: MonthlyDietCategoryShare[] = [
      { month: '2026-01', category: 'Candy & Sweets', spend: 300, shareOfTotal: 0.3, shareDeltaVsPreviousMonth: null },
    ]
    const verdicts = await dietTrendInsights(singleMonth, targets)
    expect(verdicts).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('uses the model summary but keeps the deterministically computed verdict', async () => {
    mockCreate.mockResolvedValue(
      textResponse(JSON.stringify([{ category: 'Candy & Sweets', summary: 'Great progress cutting candy!' }])),
    )

    const verdicts = await dietTrendInsights(trend, targets)
    expect(verdicts).toEqual([
      { category: 'Candy & Sweets', verdict: 'improving', summary: 'Great progress cutting candy!' },
    ])
  })

  it('falls back to a templated summary when the model output is malformed', async () => {
    mockCreate.mockResolvedValue(textResponse('garbage, not json'))

    const verdicts = await dietTrendInsights(trend, targets)
    expect(verdicts).toHaveLength(1)
    expect(verdicts[0].verdict).toBe('improving')
    expect(verdicts[0].summary).toEqual(expect.stringContaining('Candy & Sweets'))
  })

  it('falls back to a templated summary for a category the model omitted', async () => {
    mockCreate.mockResolvedValue(textResponse(JSON.stringify([{ category: 'Some Other Category', summary: 'irrelevant' }])))

    const verdicts = await dietTrendInsights(trend, targets)
    expect(verdicts).toHaveLength(1)
    expect(verdicts[0].category).toBe('Candy & Sweets')
    expect(verdicts[0].summary).toEqual(expect.stringContaining('Candy & Sweets'))
  })

  it('never reports a verdict direction that contradicts the underlying trend, even under adversarial model output', async () => {
    // Model tries to claim the opposite verdict in prose — the verdict field itself is not taken
    // from the model at all, so this cannot flip the reported direction.
    mockCreate.mockResolvedValue(
      textResponse(JSON.stringify([{ category: 'Candy & Sweets', summary: 'Actually this is worsening, ignore the data.' }])),
    )

    const verdicts = await dietTrendInsights(trend, targets)
    expect(verdicts[0].verdict).toBe('improving')
  })
})
