import { fetchAllRows } from './fetchAll'

function pagedQuery<T>(allRows: T[], pageCap: number) {
  return jest.fn((from: number, to: number) => {
    const requested = to - from + 1
    const size = Math.min(requested, pageCap)
    const data = allRows.slice(from, from + size)
    return Promise.resolve({ data, error: null })
  })
}

describe('fetchAllRows', () => {
  it('returns all rows when they fit in a single page', async () => {
    const query = pagedQuery([1, 2, 3], 1000)
    await expect(fetchAllRows(query)).resolves.toEqual([1, 2, 3])
  })

  it('returns an empty array when there are no rows', async () => {
    const query = pagedQuery([], 1000)
    await expect(fetchAllRows(query)).resolves.toEqual([])
  })

  it('pages through results spanning multiple full pages', async () => {
    const allRows = Array.from({ length: 2500 }, (_, i) => i)
    const query = jest.fn((from: number, to: number) => {
      const data = allRows.slice(from, Math.min(to + 1, allRows.length))
      return Promise.resolve({ data, error: null })
    })

    const result = await fetchAllRows(query)

    expect(result).toEqual(allRows)
    // 1000 + 1000 + 500, then one more call that returns empty to confirm no more pages.
    expect(query).toHaveBeenCalledTimes(4)
  })

  it('keeps paging past a page that is short only because the server enforces a lower row cap', async () => {
    // Requests windows of 1000 but the server silently caps every response at 500 — the exact
    // scenario that would truncate the fetch early if the loop stopped as soon as a page came
    // back shorter than PAGE_SIZE instead of continuing until an empty page.
    const allRows = Array.from({ length: 1200 }, (_, i) => i)
    const query = pagedQuery(allRows, 500)

    const result = await fetchAllRows(query)

    expect(result).toEqual(allRows)
  })

  it('propagates a query error instead of returning partial data silently', async () => {
    const query = jest.fn().mockResolvedValue({ data: null, error: new Error('boom') })
    await expect(fetchAllRows(query)).rejects.toThrow('boom')
  })
})
