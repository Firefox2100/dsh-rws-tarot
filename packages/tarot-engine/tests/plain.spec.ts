import { describe, expect, it } from 'vitest'
import { applyDraw, applyStart, describeTurn, emptyTable, PLAIN_LIMIT, seededRng, startPlain } from '../src/index.ts'

function begun(count: number, language = 'en', question = '') {
  const start = startPlain({ count, rng: seededRng(7), reversals: 0.5 })
  const table = applyStart(emptyTable, { id: 'r', method: 'plain', significator: null, facing: null, question, language, draws: start.draws, turns: start.turns, order: start.order })
  return { start, table }
}

describe('plain draw', () => {
  it('turns up the asked number of cards from the whole pack, one a turn', () => {
    const { start } = begun(3)
    expect(start.draws).toBe(3)
    expect(start.turns).toEqual([1, 1, 1])
    expect(start.order).toHaveLength(78)
    expect(new Set(start.order.map(p => p.cardId)).size).toBe(78)
  })

  it('is reproducible from its seed', () => {
    expect(startPlain({ count: 2, rng: seededRng(3), reversals: 0.5 })).toEqual(startPlain({ count: 2, rng: seededRng(3), reversals: 0.5 }))
  })

  it('refuses a count outside 1 to the limit', () => {
    for (const count of [0, -1, 1.5, PLAIN_LIMIT + 1]) expect(() => startPlain({ count, rng: seededRng(1), reversals: 0 })).toThrow(RangeError)
  })

  it('tells the model each card without a position, and asks for a closing reading on the last', () => {
    const { table } = begun(2, 'en', 'Should I go?')
    let t = applyDraw(table, { readingId: 'r', index: 0 })
    const first = describeTurn(t.readings[0]!, 0)
    expect(first).toContain('They ask: Should I go?')
    expect(first).toContain('Card 1 of 2 has just been turned over')
    expect(first).not.toContain('Its position')
    expect(first).not.toContain('Pictorial Key')
    t = applyDraw(t, { readingId: 'r', index: 1 })
    const second = describeTurn(t.readings[0]!, 1)
    expect(second).toContain('Already on the table:')
    expect(second).toContain('This is the last card.')
  })

  it('speaks Chinese for a Chinese reading', () => {
    const { table } = begun(1, 'zh')
    const t = applyDraw(table, { readingId: 'r', index: 0 })
    expect(describeTurn(t.readings[0]!, 0)).toContain('刚刚翻开')
  })
})
