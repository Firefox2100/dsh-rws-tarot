import raw from '../data/cards.json' with { type: 'json' }
import rawMethods from '../data/methods.json' with { type: 'json' }
import type { Card, Method, TarotData } from './types.ts'

export type * from './types.ts'
export { cardName, finalCardText, followUpTexts, pickLocale, positionMeaning, positionName } from './names.ts'

const SUITS = ['wands', 'cups', 'swords', 'pentacles'] as const

function validate(data: TarotData): TarotData {
  const ids = new Set<string>()
  for (const card of data.cards) {
    if (ids.has(card.id)) throw new Error(`tarot data: duplicate card id ${card.id}`)
    ids.add(card.id)
  }
  const major = data.cards.filter(c => c.arcana === 'major').length
  const minor = data.cards.filter(c => c.arcana === 'minor').length
  if (major !== 22 || minor !== 56) throw new Error(`tarot data: expected 22 major and 56 minor cards, found ${major} and ${minor}`)
  for (const suit of SUITS) {
    if (data.cards.filter(c => c.suit === suit).length !== 14) throw new Error(`tarot data: suit ${suit} is not 14 cards`)
  }
  return data
}

export const tarotData: TarotData = validate(raw as unknown as TarotData)

/** All 78 cards in the book's order: the Trumps Major from 0 to 21, then Wands, Cups, Swords, Pentacles from Ace to King. */
export const cards: readonly Card[] = tarotData.cards

const byId = new Map(cards.map(c => [c.id, c]))

export function getCard(id: string): Card {
  const card = byId.get(id)
  if (!card) throw new RangeError(`unknown card id ${JSON.stringify(id)}`)
  return card
}

export function hasCard(id: string): boolean {
  return byId.has(id)
}

function validateMethods(list: readonly Method[]): readonly Method[] {
  const ids = new Set<string>()
  for (const method of list) {
    if (ids.has(method.id)) throw new Error(`tarot data: duplicate method id ${method.id}`)
    ids.add(method.id)
    method.positions.forEach((p, i) => {
      if (p.number !== i + 1) throw new Error(`tarot data: method ${method.id} position ${i + 1} is numbered ${p.number}`)
    })
  }
  return list
}

/** The reading methods the book describes and this plugin supports, each with its positions and the book's words. */
export const methods: readonly Method[] = validateMethods((rawMethods as unknown as { methods: Method[] }).methods)

export function getMethod(id: string): Method {
  const method = methods.find(m => m.id === id)
  if (!method) throw new RangeError(`unknown method id ${JSON.stringify(id)}`)
  return method
}
