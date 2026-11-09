import raw from '../data/cards.json' with { type: 'json' }
import rawMethods from '../data/methods.json' with { type: 'json' }
import rawRecurrence from '../data/recurrence.json' with { type: 'json' }
import type { Card, CelticMethod, ContinuationMethod, LinesMethod, Method, Rank, Recurrence, TarotData } from './types.ts'

export type * from './types.ts'
export { cardName, rankName, finalCardText, followUpTexts, guidanceTexts, pickLocale, positionMeaning, positionName, colouringText, reserveText, facingText, querentText, meaningText } from './names.ts'

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
    if (method.kind === 'celtic' || method.kind === 'continuation') {
      method.positions.forEach((p, i) => {
        if (p.number !== i + 1) throw new Error(`tarot data: method ${method.id} position ${i + 1} is numbered ${p.number}`)
      })
      if (method.kind === 'continuation' && method.diagram.packets.sizes.join() !== method.packets.sizes.join()) throw new Error(`tarot data: method ${method.id} has a diagram that disagrees with its packets`)
      if (method.kind === 'continuation' && method.packets.sizes.length !== method.positions.length) throw new Error(`tarot data: method ${method.id} has ${method.packets.sizes.length} packets for ${method.positions.length} lines`)
    } else {
      const dealt = method.dealing.packets * method.dealing.perPacket
      const laid = method.layout.reduce((n, l) => n + l.lines * method.dealing.perPacket, 0)
      if (laid !== dealt) throw new Error(`tarot data: method ${method.id} lays ${laid} cards of ${dealt} dealt`)
      if (method.layout.reduce((n, l) => n + l.fromEach, 0) !== method.dealing.packets) throw new Error(`tarot data: method ${method.id} does not use every card of a packet`)
      const { dealt: drawn, regrouped, laid: lines } = method.diagram
      if (drawn.packets !== method.dealing.packets || regrouped.packets !== method.dealing.perPacket || lines.perLine !== regrouped.packets || lines.lines !== method.layout.reduce((n, l) => n + l.lines, 0)) throw new Error(`tarot data: method ${method.id} has a diagram that disagrees with its dealing`)
    }
  }
  return list
}

/** The reading methods the book describes and this plugin supports, each with its positions and the book's words. */
export const methods: readonly Method[] = validateMethods((rawMethods as unknown as { methods: Method[] }).methods)

export function getMethod(id: 'celtic'): CelticMethod
export function getMethod(id: 'alternative'): LinesMethod
export function getMethod(id: 'thirtyfive'): ContinuationMethod
export function getMethod(id: string): Method
export function getMethod(id: string): Method {
  const method = methods.find(m => m.id === id)
  if (!method) throw new RangeError(`unknown method id ${JSON.stringify(id)}`)
  return method
}

const recurrences: readonly Recurrence[] = (rawRecurrence as unknown as { entries: Recurrence[] }).entries
if (recurrences.length !== 84) throw new Error(`tarot data: expected 84 recurrences, found ${recurrences.length}`)

/** What the book says of `count` cards of one rank together, upright or reversed; undefined for a count the book gives nothing for. */
export function recurrence(rank: Rank, count: number, reversed: boolean): Recurrence | undefined {
  return recurrences.find(r => r.rank === rank && r.count === count && r.position === (reversed ? 'reversed' : 'natural'))
}
