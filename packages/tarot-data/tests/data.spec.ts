import { describe, expect, it } from 'vitest'
import { cards, getCard, hasCard, meaningText, recurrence, recurrenceMeaning, tarotData } from '../src/index.ts'

const TRANSLATED_LOCALES = ['zh', 'de', 'es', 'fr', 'ja', 'pt', 'ru'] as const

describe('tarot data', () => {
  it('holds the 78 cards: 22 trumps and 14 per suit', () => {
    expect(cards).toHaveLength(78)
    expect(cards.filter(c => c.arcana === 'major').map(c => c.number)).toEqual([...Array(22).keys()])
    for (const suit of ['wands', 'cups', 'swords', 'pentacles']) {
      expect(cards.filter(c => c.suit === suit).map(c => c.number)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1))
    }
  })

  it('gives every card an image, a picture description and an upright divinatory meaning', () => {
    for (const c of cards) {
      expect(c.image.file, c.id).toMatch(/\.jpg$/)
      expect(c.pictorial?.text.length, c.id).toBeGreaterThan(0)
      expect(c.meanings.some(m => m.context === 'divinatory' && m.scenario === 'upright'), c.id).toBe(true)
    }
  })

  it('has a reversed divinatory meaning for every card but the Two of Cups, which the book leaves without', () => {
    const missing = cards.filter(c => !c.meanings.some(m => m.context === 'divinatory' && m.scenario === 'reversed')).map(c => c.id)
    expect(missing).toEqual(['cups-02'])
  })

  it('finds cards by id and refuses unknown ones', () => {
    expect(getCard('major-00').name).toBe('The Fool')
    expect(hasCard('wands-14')).toBe(true)
    expect(() => getCard('nope')).toThrow(RangeError)
  })

  it('keeps the book notes', () => {
    expect(tarotData.sectionNotes.map(n => n.id)).toEqual(['lesser-arcana-remark', 'additional-meanings-remark'])
  })

  it('translates every meaning into each supported locale and keeps English canonical', () => {
    for (const locale of TRANSLATED_LOCALES) for (const card of cards) card.meanings.forEach((meaning, index) => {
      expect(meaningText(card, index, locale), `${locale}:${card.id}[${index}]`).not.toHaveLength(0)
      expect(meaningText(card, index, 'en'), `${card.id}[${index}]`).toBe(meaning.text)
    })
  })
})

describe('methods', () => {
  it('holds the Ancient Celtic Method with ten numbered positions', async () => {
    const { getMethod } = await import('../src/index.ts')
    const celtic = getMethod('celtic')
    expect(celtic.positions).toHaveLength(10)
    expect(celtic.positions[0]!.name).toBe('What covers him')
    expect(celtic.positions[9]!.name).toBe('What will come')
    expect(celtic.preparation.shuffleAndCutTimes).toBe(3)
  })
  it('holds the Alternative Method: 42 cards dealt, laid as 1, 2 and 3 groups of the packets\' tops', async () => {
    const { getMethod } = await import('../src/index.ts')
    const alternative = getMethod('alternative')
    expect(alternative.dealing.packets * alternative.dealing.perPacket).toBe(42)
    expect(alternative.layout.map(l => [l.lines, l.fromEach])).toEqual([[1, 1], [2, 2], [3, 3]])
    expect([alternative.querent.male, alternative.querent.female]).toEqual(['major-01', 'major-02'])
    expect(alternative.direction).toBe('right-to-left')
    expect(alternative.diagram).toMatchObject({ dealt: { packets: 6, firstAt: 'right' }, regrouped: { packets: 7, firstAt: 'right' }, laid: { lines: 6, perLine: 7, numberedFrom: 'right' } })
  })
  it('holds the thirty-five card continuation with six lines of unequal length', async () => {
    const { getMethod, positionName, positionMeaning } = await import('../src/index.ts')
    const method = getMethod('thirtyfive')
    expect(method.packets.sizes).toEqual([7, 6, 5, 4, 2, 11])
    expect(method.packets.sizes.reduce((a, b) => a + b, 0)).toBe(35)
    expect(method.continues).toBe('alternative')
    expect(method.direction).toBe('left-to-right')
    expect(method.diagram.packets).toMatchObject({ sizes: [7, 6, 5, 4, 2, 11], firstAt: 'right' })
    expect(method.positions[4]!.meaning).toContain('consolation')
    expect(positionName('thirtyfive', method.positions[0]!, 'zh')).toBe('第一行')
    expect(positionMeaning('thirtyfive', method.positions[4]!, 'zh')).toContain('安慰')
    expect(positionName('thirtyfive', method.positions[0]!, 'fr')).toBe('Première ligne')
  })
  it('refuses an unknown method', async () => {
    const { getMethod } = await import('../src/index.ts')
    expect(() => getMethod('nope')).toThrow(RangeError)
  })
})

describe('names', () => {
  it('names all 78 cards distinctly in every supported locale and keeps the book title for an unknown language', async () => {
    const { cardName, getCard } = await import('../src/index.ts')
    for (const locale of TRANSLATED_LOCALES) expect(new Set(cards.map(c => cardName(c, locale))).size, locale).toBe(78)
    expect(cardName(getCard('pentacles-08'), 'zh-CN')).toBe('星币八')
    expect(cardName(getCard('cups-13'), 'de')).toBe('Königin der Kelche')
    expect(cardName(getCard('cups-13'), 'ja')).toBe('カップのクイーン')
    expect(cardName(getCard('major-16'), 'en')).toBe('The Tower')
    expect(cardName(getCard('cups-13'), undefined)).toBe('Queen of Cups')
  })
  it('names the ten positions of the Celtic Cross in Chinese', async () => {
    const { getMethod, positionName } = await import('../src/index.ts')
    const celtic = getMethod('celtic')
    expect(celtic.positions.map(p => positionName('celtic', p, 'zh'))).toHaveLength(10)
    expect(positionName('celtic', celtic.positions[0]!, 'en')).toBe('What covers him')
  })
  it('translates every position meaning and follow-up rule of the Celtic Cross, and falls back to the book', async () => {
    const { followUpTexts, finalCardText, getMethod, positionMeaning } = await import('../src/index.ts')
    const celtic = getMethod('celtic')
    for (const p of celtic.positions) {
      expect(positionMeaning('celtic', p, 'zh')).toMatch(/[\u4e00-\u9fff]/)
      expect(positionMeaning('celtic', p, 'en')).toBe(p.meaning)
    }
    expect(followUpTexts(celtic, 'zh')).toHaveLength(celtic.followUp.length)
    expect(followUpTexts(celtic, 'zh').every(t => /[\u4e00-\u9fff]/.test(t))).toBe(true)
    expect(finalCardText(celtic, 'zh')).toMatch(/[\u4e00-\u9fff]/)
    expect(followUpTexts(celtic, 'fr')).not.toEqual(celtic.followUp.map(f => f.text))
  })
  it('resolves a locale by id, then language, then fallback', async () => {
    const { pickLocale } = await import('../src/index.ts')
    const table = { en: 'a', zh: 'b' }
    expect(pickLocale(table, 'zh-CN', 'en')).toBe('b')
    expect(pickLocale(table, 'fr', 'en')).toBe('a')
    expect(pickLocale(table, undefined, 'en')).toBe('a')
  })

  it('holds what the book says of recurring ranks, upright and reversed', () => {
    expect(recurrence('king', 3, false)).toMatchObject({ text: '3 Kings = consultation', means: 'consultation' })
    expect(recurrence('ace', 2, true)?.means).toBe('enemies')
    expect(recurrence('knight', 3, true)?.means).toBe('a duel, or personal encounter')
    expect(recurrence('king', 5, false)).toBeUndefined()
    const kings = recurrence('king', 3, false)!
    for (const locale of TRANSLATED_LOCALES) expect(recurrenceMeaning(kings, locale)).not.toHaveLength(0)
    expect(recurrenceMeaning(kings, 'en')).toBe(kings.means)
  })
})
