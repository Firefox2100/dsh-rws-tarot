import { describe, expect, it } from 'vitest'
import { applyDraw, applyStart, describeEnd, describeTurn, emptyTable, isLayout, LAYOUT_SIZES, seededRng, startLayout, type LayoutId } from '../src/index.ts'

function laid(id: LayoutId, language = 'en', question = '') {
  const start = startLayout({ id, rng: seededRng(7), reversals: 0 })
  let table = applyStart(emptyTable, { id: 'r', method: id, significator: null, facing: null, question, language, draws: start.draws, turns: start.turns, order: start.order })
  const turned = (n: number) => {
    for (let i = 0; i < n; i++) table = applyDraw(table, { readingId: 'r', index: i })
    return table.readings[0]!
  }
  return { start, turned }
}

describe('layouts of three and nine cards', () => {
  it('knows its two layouts', () => {
    expect(isLayout('three')).toBe(true)
    expect(isLayout('nine')).toBe(true)
    expect(isLayout('celtic')).toBe(false)
    expect(isLayout('plain')).toBe(false)
  })

  it('turns up three or nine cards from the whole pack, one a turn', () => {
    for (const id of ['three', 'nine'] as const) {
      const { start } = laid(id)
      expect(start.draws).toBe(LAYOUT_SIZES[id])
      expect(start.turns).toEqual(Array.from({ length: LAYOUT_SIZES[id] }, () => 1))
      expect(start.order).toHaveLength(78)
    }
  })

  it('gives each of the three cards its place, with the book\'s account of the one it borrows', () => {
    const { turned } = laid('three', 'en', 'Should I go?')
    const names = ['Past', 'Present', 'Future']
    const accounts = ['just passed, or is now passing away', 'the atmosphere of it', 'coming into action and will operate in the near future']
    names.forEach((name, i) => {
      const text = describeTurn(turned(i + 1), i)
      expect(text).toContain(`Its position is "${name}"`)
      expect(text).toContain(accounts[i]!)
      expect(text).not.toContain('Pictorial Key')
    })
    expect(describeTurn(turned(1), 0)).toContain('They ask: Should I go?')
    expect(describeTurn(turned(3), 2)).toContain('This is the last card.')
    expect(describeTurn(turned(2), 1)).toContain('Already on the table:')
  })

  it('places the nine as three rows of three: columns are time, rows are levels, the centre and corners are marked', () => {
    const { turned } = laid('nine')
    const at = (n: number) => describeTurn(turned(n), n - 1)
    expect(at(1)).toContain('Its position is "Thought, Past"')
    expect(at(1)).toContain('corner')
    expect(at(2)).toContain('"Thought, Present"')
    expect(at(2)).not.toContain('corner')
    expect(at(3)).toContain('"Thought, Near future"')
    expect(at(5)).toContain('"Reality, Present"')
    expect(at(5)).toContain('the underlying theme')
    expect(at(7)).toContain('"Undercurrent, Past"')
    expect(at(9)).toContain('"Undercurrent, Near future"')
    expect(at(9)).toContain('This is the last card. After speaking to it, read the nine together')
    expect(at(1)).toContain('three rows of three')
  })

  it('is reproducible from its seed', () => {
    expect(startLayout({ id: 'nine', rng: seededRng(3), reversals: 0.5 })).toEqual(startLayout({ id: 'nine', rng: seededRng(3), reversals: 0.5 }))
  })

  it('speaks Chinese for a Chinese reading', () => {
    const { turned } = laid('nine', 'zh')
    const text = describeTurn(turned(1), 0)
    expect(text).toContain('刚刚翻开')
    expect(text).toContain('“思想，过去”')
    expect(describeTurn(laid('three', 'zh').turned(1), 0)).toContain('“过去”')
  })

  it('tells the model when a reading is ended, in its language', () => {
    expect(describeEnd(laid('nine').turned(4))).toContain('ended the reading after 4 of 9 cards')
    expect(describeEnd(laid('three', 'zh').turned(1))).toContain('第 1 张（共 3 张）之后结束了这次占卜')
  })
})
