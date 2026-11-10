import { describe, expect, it } from 'vitest'
import { applyDraw, applyStart, describeTurn, emptyTable, newRecurrences, type Placed } from '../src/index.ts'

const up = (cardId: string): Placed => ({ cardId, reversed: false })
const down = (cardId: string): Placed => ({ cardId, reversed: true })

describe('recurrence of cards', () => {
  it('finds a rank that now lies twice, three times or four times, and says so only when the count grows', () => {
    expect(newRecurrences([up('wands-14')], [up('cups-14')]).map(r => r.text)).toEqual(['2 Kings = minor counsel'])
    expect(newRecurrences([up('wands-14'), up('cups-14')], [up('swords-14')]).map(r => r.text)).toEqual(['3 Kings = consultation'])
    expect(newRecurrences([up('wands-14'), up('cups-14'), up('swords-14')], [up('pentacles-14')]).map(r => r.text)).toEqual(['4 Kings = great honour'])
    expect(newRecurrences([up('wands-14'), up('cups-14')], [up('wands-01')])).toEqual([])
  })

  it('keeps upright and reversed cards apart, and ignores the Trumps', () => {
    expect(newRecurrences([up('wands-14')], [down('cups-14')])).toEqual([])
    expect(newRecurrences([down('wands-14')], [down('cups-14')]).map(r => r.text)).toEqual(['2 Kings = projects'])
    expect(newRecurrences([up('major-01')], [up('major-01')])).toEqual([])
  })

  it('counts every card of a line turned together', () => {
    expect(newRecurrences([], [up('wands-10'), up('cups-10'), up('swords-10')]).map(r => r.text)).toEqual(['3 Tens = new condition'])
  })

  it('puts the book\'s phrase in front of the model, in the language of the reading', () => {
    const order = [up('wands-14'), up('cups-14')]
    for (const [language, expected] of [['en', '2 Kings now lie on the table together: minor counsel.'], ['zh', '桌上现有2张国王：小建议。']] as const) {
      let t = applyStart(emptyTable, { id: 'r', method: 'plain', significator: null, facing: null, question: '', language, draws: 2, turns: [1, 1], order })
      t = applyDraw(applyDraw(t, { readingId: 'r', index: 0 }), { readingId: 'r', index: 1 })
      expect(describeTurn(t.readings[0]!, 0)).not.toContain('together')
      expect(describeTurn(t.readings[0]!, 1)).toContain(expected)
    }
  })
})
