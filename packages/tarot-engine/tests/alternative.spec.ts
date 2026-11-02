import { describe, expect, it } from 'vitest'
import { applyDraw, applyStart, continueAlternative, describeTurn, emptyTable, fullDeck, seededRng, startAlternative, type Reading } from '../src/index.ts'

function begin(seed: string, sex: 'male' | 'female' = 'male', reversals = 0.5, question = '', language = 'en'): Reading {
  const start = startAlternative({ sex, rng: seededRng(seed), reversals })
  return applyStart(emptyTable, { id: 'r1', method: 'alternative', significator: start.significator, facing: null, question, language, draws: start.draws, turns: start.turns, order: start.order }).readings[0]!
}

describe('Alternative Method', () => {
  it('lays 42 cards in six lines of seven and keeps the rest of the pack', () => {
    const start = startAlternative({ sex: 'female', rng: seededRng('a'), reversals: 0.5 })
    expect(start.draws).toBe(42)
    expect(start.turns).toEqual([7, 7, 7, 7, 7, 7])
    expect(start.order).toHaveLength(77)
    const ids = [...start.order.map(p => p.cardId), start.significator.cardId]
    expect(new Set(ids).size).toBe(78)
    expect([...ids].sort()).toEqual([...fullDeck()].sort())
  })

  it('is reproducible from its seed', () => {
    expect(begin('x').order).toEqual(begin('x').order)
    expect(begin('x').order).not.toEqual(begin('y').order)
  })

  it('stands the Magician for a man and the High Priestess for a woman, never among the cards', () => {
    expect(begin('b', 'male').significator).toEqual({ cardId: 'major-01', reversed: false })
    expect(begin('b', 'female').significator).toEqual({ cardId: 'major-02', reversed: false })
    for (let i = 0; i < 40; i++) {
      const reading = begin(`q${i}`, i % 2 === 0 ? 'male' : 'female')
      expect(reading.order.some(p => p.cardId === reading.significator!.cardId)).toBe(false)
    }
  })

  it('turns no card round when reversals are off, and some when on', () => {
    expect(begin('c', 'male', 0).order.some(p => p.reversed)).toBe(false)
    expect(begin('c', 'male', 1).order.slice(0, 42).every(p => p.reversed)).toBe(true)
  })

  it('draws a replacement from the undealt cards when the Querent card was in the layout', () => {
    // The Magician is dealt among the first 42 about 54% of the time; across many seeds both cases occur and the layout stays 42 distinct cards.
    let dealtCase = 0
    for (let i = 0; i < 60; i++) {
      const rng = seededRng(`w${i}`)
      const start = startAlternative({ sex: 'male', rng, reversals: 0 })
      const laid = start.order.slice(0, 42).map(p => p.cardId)
      expect(new Set(laid).size).toBe(42)
      const before = startAlternative({ sex: 'female', rng: seededRng(`w${i}`), reversals: 0 })
      if (before.order.slice(0, 42).some(p => p.cardId === 'major-01')) dealtCase++
    }
    expect(dealtCase).toBeGreaterThan(0)
  })

  it('turns a whole line at a time', () => {
    let table = { readings: [begin('d')] }
    for (let line = 0; line < 6; line++) table = applyDraw(table, { readingId: 'r1', index: line * 7 })
    expect(table.readings[0]!.drawn).toBe(42)
    expect(applyDraw(table, { readingId: 'r1', index: 42 })).toBe(table)
    const skipped = applyDraw({ readings: [begin('d')] }, { readingId: 'r1', index: 7 })
    expect(skipped.readings[0]!.drawn).toBe(0)
  })

  it('gives the model one line, the Querent card and the lines already down', () => {
    const reading = begin('e', 'male', 0.5, 'What lies ahead?')
    const first = describeTurn({ ...reading, drawn: 7 }, 0)
    expect(first).toContain('Forty-two cards are laid in six lines of seven')
    expect(first).toContain('They ask: What lies ahead?')
    expect(first).toContain('lies face up beside the first line: The Magician')
    expect(first).toContain('Line 1 of 6 has just been turned over')
    expect(first).toContain('Card 7:')
    expect(first).toContain('Keep in mind: ')
    expect(first).not.toContain('Already on the table')
    expect(first).not.toMatch(/Pictorial Key|Waite/)

    const third = describeTurn({ ...reading, drawn: 21 }, 14)
    expect(third).toContain('Line 3 of 6 has just been turned over')
    expect(third).toContain('Already on the table:')
    expect(third).toContain('Line 2:')
    expect(third).not.toContain('Forty-two cards are laid')
    expect(third).not.toContain('closing reading')

    expect(describeTurn({ ...reading, drawn: 42 }, 35)).toContain('This is the last line')
    expect(() => describeTurn({ ...reading, drawn: 7 }, 7)).toThrow(RangeError)
    expect(() => describeTurn({ ...reading, drawn: 10 }, 3)).toThrow(RangeError)
  })

  it('speaks Chinese when the reading is held in Chinese', () => {
    const reading = begin('f', 'female', 0.5, '', 'zh')
    const text = describeTurn({ ...reading, drawn: 7 }, 0)
    expect(text).toContain('四十二张牌排成六行')
    expect(text).toContain('女祭司')
    expect(text).toContain('请记住: ')
    expect(text).toContain('第 1 行（共 6 行）刚刚翻开')
  })
})

describe('Thirty-five card continuation', () => {
  const finished = (seed: string, language = 'en'): Reading => ({ ...begin(seed, 'male', 0.5, '', language), drawn: 42 })

  it('shuffles the 35 undealt cards into packets of 7, 6, 5, 4, 2 and 11, keeping the Querent card', () => {
    const before = finished('g')
    const next = continueAlternative(before, seededRng('h'))
    expect(next.turns).toEqual([7, 6, 5, 4, 2, 11])
    expect(next.draws).toBe(35)
    expect(next.order).toHaveLength(35)
    expect(next.significator).toEqual(before.significator)
    expect(new Set(next.order.map(p => p.cardId))).toEqual(new Set(before.order.slice(42).map(p => p.cardId)))
    expect(next.order).not.toEqual(before.order.slice(42))
    expect(continueAlternative(before, seededRng('h')).order).toEqual(next.order)
  })

  it('refuses a reading that is not a finished alternative reading', () => {
    expect(() => continueAlternative({ ...begin('i'), drawn: 14 }, seededRng('j'))).toThrow('not finished')
    expect(() => continueAlternative({ ...begin('i'), method: 'celtic', drawn: 42 }, seededRng('j'))).toThrow(RangeError)
  })

  const continuation = (language = 'en', question = ''): Reading => {
    const next = continueAlternative(finished('k', language), seededRng('l'))
    return applyStart(emptyTable, { id: 'r2', method: 'thirtyfive', significator: next.significator, facing: null, question, language, draws: next.draws, turns: next.turns, order: next.order }).readings[0]!
  }

  it('turns the lines of unequal length one at a time', () => {
    let table = { readings: [continuation()] }
    for (const from of [0, 7, 13, 18, 22, 24]) table = applyDraw(table, { readingId: 'r2', index: from })
    expect(table.readings[0]!.drawn).toBe(35)
    const skipped = applyDraw({ readings: [continuation()] }, { readingId: 'r2', index: 7 })
    expect(skipped.readings[0]!.drawn).toBe(0)
  })

  it('gives the model the line, what the line stands for, and reads left to right', () => {
    const reading = continuation('en', 'What did I miss?')
    const first = describeTurn({ ...reading, drawn: 7 }, 0)
    expect(first).toContain('carrying a tarot reading further')
    expect(first).toContain('They ask: What did I miss?')
    expect(first).toContain('Line 1 of 6 has just been turned over. Its cards, from the left of the line to its right')
    expect(first).toContain('The First Line stands for the house')
    expect(first).not.toContain('Querent card')
    const fifth = describeTurn({ ...reading, drawn: 24 }, 22)
    expect(fifth).toContain('consolation')
    expect(fifth).toContain('Line 4:')
    expect(describeTurn({ ...reading, drawn: 35 }, 24)).toContain('This is the last line')
    expect(describeTurn({ ...reading, drawn: 35 }, 24)).toContain('The Sixth Line is that which must be consulted')
    expect(() => describeTurn({ ...reading, drawn: 7 }, 3)).toThrow(RangeError)
  })

  it('speaks Chinese with the Chinese line names', () => {
    const text = describeTurn({ ...continuation('zh'), drawn: 7 }, 0)
    expect(text).toContain('继续下去')
    expect(text).toContain('“第一行”')
    expect(text).toContain('从左到右')
  })
})
