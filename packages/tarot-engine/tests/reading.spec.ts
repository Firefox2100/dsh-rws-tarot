import { describe, expect, it } from 'vitest'
import { applyDraw, applyStart, describeCard, emptyTable, seededRng, significatorFor, startCeltic, rankFor, type Reading } from '../src/index.ts'

function begin(seed: string, question = '', language = 'en') {
  const start = startCeltic({ significatorId: significatorFor({ sex: 'female', fortyOrOver: true }, 'cups'), facing: 'left', rng: seededRng(seed), reversals: 0 })
  return applyStart(emptyTable, { id: 'r1', method: 'celtic', significator: start.significator, facing: start.facing, question, language, draws: start.draws, turns: start.turns, order: start.order }).readings[0]!
}

describe('Significator', () => {
  it('follows the book: Knight for a man of forty or over, King for a younger male, Queen for a woman over forty, Page for a younger female', () => {
    expect(rankFor({ sex: 'male', fortyOrOver: true })).toBe('knight')
    expect(rankFor({ sex: 'male', fortyOrOver: false })).toBe('king')
    expect(rankFor({ sex: 'female', fortyOrOver: true })).toBe('queen')
    expect(rankFor({ sex: 'female', fortyOrOver: false })).toBe('page')
    expect(significatorFor({ sex: 'female', fortyOrOver: true }, 'cups')).toBe('cups-13')
  })
})

describe('Celtic start', () => {
  it('leaves 77 cards without the Significator and is reproducible from the seed', () => {
    const a = begin('x')
    expect(a.order).toHaveLength(77)
    expect(a.order.some(p => p.cardId === 'cups-13')).toBe(false)
    expect(begin('x').order).toEqual(a.order)
    expect(begin('y').order).not.toEqual(a.order)
    expect(a.draws).toBe(10)
    expect(a.order.every(p => !p.reversed)).toBe(true)
  })
})

describe('table', () => {
  it('turns cards up one at a time, in order, up to the method\'s ten', () => {
    let table = { readings: [begin('z')] }
    expect(applyDraw(table, { readingId: 'r1', index: 1 })).toBe(table)
    for (let i = 0; i < 10; i++) table = applyDraw(table, { readingId: 'r1', index: i })
    expect(table.readings[0]!.drawn).toBe(10)
    expect(applyDraw(table, { readingId: 'r1', index: 10 })).toBe(table)
    expect(applyDraw(table, { readingId: 'nope', index: 0 })).toBe(table)
  })
})

describe('describeCard', () => {
  const reading = (n: number, question = '', language = 'en'): Reading => ({ ...begin('z', question, language), drawn: n })

  it('tells the model how to speak and where the first card fell, with the Significator and the question', () => {
    const text = describeCard(reading(1, 'Will the move go well?'), 0)
    expect(text).toContain('You are reading tarot for the person asking.')
    expect(text).toContain('Speak to the person directly as "you"')
    expect(text).toContain('never as "the Querent"')
    expect(text).toContain('Do not use headings, lists, bold text or card numbers')
    expect(text).toContain('They ask: Will the move go well?')
    expect(text).toContain('The card standing for them, or for the matter asked about, lies face up: Queen of Cups.')
    expect(text).toContain('Card 1 of 10 has just been turned over:')
    expect(text).toContain('Its position is "What covers him": This card gives the influence')
  })

  it('speaks the language of the screen: names, wording and the request to answer in it', () => {
    const text = describeCard(reading(1, '搬家顺利吗？', 'zh-CN'), 0)
    expect(text).toContain('你正在为提问者解读塔罗')
    expect(text).toContain('直接用“你”称呼对方')
    expect(text).toContain('他们问：搬家顺利吗？')
    expect(text).toContain('代表他们或所问之事的牌面朝上：')
    expect(text).toContain('第 1 张牌（共 10 张）刚刚翻开：')
    expect(text).toContain('其位置是“覆盖”：')
    const later = describeCard(reading(3, '', 'zh'), 2)
    expect(later).toContain('其位置是“冠冕”：')
    expect(later).toContain('  1. 覆盖:')
    const french = describeCard(reading(3, '', 'fr'), 2)
    expect(french).not.toBe(describeCard(reading(3, '', 'en'), 2))
    expect(french).toContain('Déjà sur la table')
  })

  it('gives the last card\'s guidance in the language of the reading', () => {
    const text = describeCard(reading(10, '', 'zh'), 9)
    expect(text).toContain('针对此位置: 占卜师应特别在此牌上')
    expect(text).toContain('如果适用: ')
    expect(text).not.toContain('Diviner')
  })

  it('never names the book, its author or a part of it', () => {
    const all = Array.from({ length: 10 }, (_, i) => describeCard(reading(i + 1, 'q'), i)).join('\n')
    expect(all).not.toMatch(/Waite|Pictorial|Part III|§|\bthe book\b|\bbook\b/i)
  })

  it('lists the cards already on the table for a later card and leaves out the style note', () => {
    const text = describeCard(reading(3), 2)
    expect(text).not.toContain('You are reading tarot')
    expect(text).toContain('Already on the table:')
    expect(text).toContain('  1. What covers him:')
    expect(text).toContain('Its position is "What crowns him":')
  })

  it('names a reversed card as such and gives its reversed meaning', () => {
    const base = begin('z')
    const r: Reading = { ...base, order: [{ cardId: 'major-16', reversed: true }, ...base.order.slice(1)], drawn: 1 }
    const text = describeCard(r, 0)
    expect(text).toContain('has just been turned over: The Tower, reversed.')
    expect(text).toContain('Meaning: ')
  })

  it('asks for a closing reading on the last card and adds the guidance for that position', () => {
    const text = describeCard(reading(10), 9)
    expect(text).toContain('This is the last card. After speaking to it, bring the whole spread together')
    expect(text).toContain('For this position: It is on this card')
    expect(text).toContain('If it applies: should it happen that the last card is of a dubious nature')
  })

  it('says plainly when a card has no meaning in that orientation instead of supplying one', () => {
    const base = begin('z')
    const r: Reading = { ...base, order: [{ cardId: 'cups-02', reversed: true }, ...base.order.slice(1)], drawn: 1 }
    expect(describeCard(r, 0)).toContain('No reversed meaning is given for this card')
  })

  it('refuses a card that has not been turned up', () => {
    expect(() => describeCard(reading(2), 2)).toThrow(RangeError)
  })
})
