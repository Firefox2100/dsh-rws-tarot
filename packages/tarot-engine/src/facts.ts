import { cardName, finalCardText, followUpTexts, getCard, getMethod, guidanceTexts, meaningText, pickLocale, positionMeaning, positionName, rankName, recurrenceMeaning, type Card, type Recurrence } from '@dsh-rws-tarot/data'
import wordTemplates from '../data/words.json' with { type: 'json' }
import type { Placed } from './pack.ts'
import { isLayout, type LayoutId } from './layouts.ts'
import { PLAIN_METHOD } from './plain.ts'
import { newRecurrences } from './recurrence.ts'
import { turnAt, type Reading } from './table.ts'

/**
 * The wording the model is given, one pack per language. Each tells the model what the reading is and how to sound,
 * never where the meanings come from: naming a source or reciting a text is what makes an answer mechanical. The
 * English remains the canonical wording; every other pack is a translation of it.
 */
interface Words {
  readonly style: readonly string[]
  readonly asks: (question: string) => string
  readonly significator: (name: string) => string
  readonly turned: (n: number, total: number, name: string) => string
  readonly position: (name: string, meaning: string) => string
  readonly meaning: string
  readonly also: string
  readonly noMeaning: (orientation: string) => string
  readonly table: string
  readonly last: string
  readonly forPosition: string
  readonly ifApplies: string
  readonly upright: string
  readonly reversed: string
  readonly reversedName: (name: string) => string
  readonly linesStyle: readonly string[]
  readonly querent: (name: string) => string
  readonly lineTurned: (n: number, total: number, rightToLeft: boolean) => string
  readonly lineCard: (n: number, name: string) => string
  readonly lineName: (n: number) => string
  readonly separator: string
  readonly linesLast: string
  readonly continueStyle: readonly string[]
  readonly continueLast: string
  readonly guidance: string
  readonly plainStyle: readonly string[]
  readonly plainTurned: (n: number, total: number, name: string) => string
  readonly plainLast: string
  readonly recurrence: (count: number, rank: string, reversed: boolean, means: string) => string
  readonly layoutStyle: Readonly<Record<LayoutId, readonly string[]>>
  readonly layoutLast: Readonly<Record<LayoutId, string>>
  /** The three-card layout's places in order: past, present, future. */
  readonly threeSlots: readonly string[]
  readonly nineRows: readonly Slot[]
  readonly nineColumns: readonly Slot[]
  readonly nineCell: (row: string, column: string) => string
  readonly nineCentre: string
  readonly nineCorner: string
  readonly ended: (drawn: number, total: number) => string
}

interface Slot {
  readonly name: string
  readonly meaning: string
}

type WordTemplate = typeof wordTemplates.en

function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{([A-Za-z]+)\}/g, (token, key: string) => values[key]?.toString() ?? token)
}

function makeWords(template: WordTemplate): Words {
  return {
    style: template.style,
    asks: question => fill(template.asks, { question }),
    significator: name => fill(template.significator, { name }),
    turned: (n, total, name) => fill(template.turned, { n, total, name }),
    position: (name, meaning) => fill(template.position, { name, meaning }),
    meaning: template.meaning,
    also: template.also,
    noMeaning: orientation => fill(template.noMeaning, { orientation }),
    table: template.table,
    last: template.last,
    forPosition: template.forPosition,
    ifApplies: template.ifApplies,
    upright: template.upright,
    reversed: template.reversed,
    reversedName: name => fill(template.reversedName, { name }),
    linesStyle: template.linesStyle,
    querent: name => fill(template.querent, { name }),
    lineTurned: (n, total, rightToLeft) => fill(rightToLeft ? template.lineTurnedRtl : template.lineTurnedLtr, { n, total }),
    lineCard: (n, name) => fill(template.lineCard, { n, name }),
    lineName: n => fill(template.lineName, { n }),
    separator: template.separator,
    linesLast: template.linesLast,
    continueStyle: template.continueStyle,
    continueLast: template.continueLast,
    guidance: template.guidance,
    plainStyle: template.plainStyle,
    plainTurned: (n, total, name) => fill(template.plainTurned, { n, total, name }),
    plainLast: template.plainLast,
    recurrence: (count, rank, reversed, means) => fill(reversed ? template.recurrenceReversed : template.recurrence, { n: count, rank, means }),
    layoutStyle: template.layoutStyle,
    layoutLast: template.layoutLast,
    threeSlots: template.threeSlots,
    nineRows: template.nineRows,
    nineColumns: template.nineColumns,
    nineCell: (row, column) => fill(template.nineCell, { row, column }),
    nineCentre: template.nineCentre,
    nineCorner: template.nineCorner,
    ended: (drawn, total) => fill(template.ended, { n: drawn, total }),
  }
}

const WORDS: Readonly<Record<string, Words>> = Object.fromEntries(
  Object.entries(wordTemplates).map(([locale, template]) => [locale, makeWords(template)]),
)


/** What the book says when this turn brings two or more cards of one rank onto the table. */
function recurrenceLines(reading: Reading, from: number, size: number, words: Words): string[] {
  const found = newRecurrences(reading.order.slice(0, from), reading.order.slice(from, from + size))
  return found.length === 0 ? [] : ['', ...found.map((r: Recurrence) => words.recurrence(r.count, rankName(r.rank, reading.language), r.position === 'reversed', recurrenceMeaning(r, reading.language)))]
}

function meaningLines(card: Card, placed: Placed, indent: string, words: Words, locale: string): string[] {
  const scenario = placed.reversed ? 'reversed' : 'upright'
  const lines: string[] = []
  const divinatory = card.meanings.map((meaning, index) => ({ meaning, index })).filter(({ meaning }) => meaning.scenario === scenario && meaning.context === 'divinatory')
  for (const { index } of divinatory) lines.push(`${indent}${words.meaning}: ${meaningText(card, index, locale)}`)
  if (divinatory.length === 0) lines.push(`${indent}${words.noMeaning(words[scenario])}`)
  for (const { index } of card.meanings.map((meaning, index) => ({ meaning, index })).filter(({ meaning }) => meaning.scenario === scenario && meaning.context === 'additional')) lines.push(`${indent}${words.also}: ${meaningText(card, index, locale)}`)
  return lines
}

/**
 * What to put in front of the model when a card is turned up: the card, the position it fell in, the cards already on
 * the table, and the meanings to draw on. Nothing here is an interpretation. The reading's language is that of the
 * person's screen; the names and the wording follow it, and the model's own language follows from them.
 */
export function describeCard(reading: Reading, index: number): string {
  const locale = reading.language
  const words = pickLocale(WORDS, locale, 'en')
  const method = getMethod('celtic')
  if (reading.method !== method.id) throw new RangeError(`describeCard: ${reading.method} is not read one card at a time`)
  const position = method.positions[index]
  const placed = reading.order[index]
  if (position === undefined || placed === undefined || index >= reading.drawn) throw new RangeError(`describeCard: card ${index + 1} has not been turned up`)
  const turned = reading.order.slice(0, index)
  const named = (p: Placed): string => {
    const name = cardName(getCard(p.cardId), locale)
    return p.reversed ? words.reversedName(name) : name
  }
  const where = (i: number): string => positionName(method.id, method.positions[i]!, locale)
  const lines: string[] = []

  if (index === 0) {
    lines.push(...words.style, '')
    if (reading.question.trim() !== '') lines.push(words.asks(reading.question.trim()), '')
    if (reading.significator !== null) {
      lines.push(words.significator(named(reading.significator)), ...meaningLines(getCard(reading.significator.cardId), reading.significator, '  ', words, locale), '')
    }
  }

  lines.push(words.turned(index + 1, reading.draws, named(placed)))
  lines.push(words.position(where(index), positionMeaning(method.id, position, locale)))
  lines.push(...meaningLines(getCard(placed.cardId), placed, '  ', words, locale))
  if (turned.length > 0) {
    lines.push('', words.table, ...turned.map((p, i) => `  ${i + 1}. ${where(i)}: ${named(p)}`))
  }
  lines.push(...recurrenceLines(reading, index, 1, words))
  if (index + 1 === reading.draws) {
    lines.push('', words.last)
    lines.push(`${words.forPosition}: ${finalCardText(method, locale)}`)
    for (const text of followUpTexts(method, locale)) lines.push(`${words.ifApplies}: ${text}`)
  }
  return lines.join('\n')
}

/** The same for a layout read a line at a time: the line just turned, the lines already down, and each card's meanings. */
function describeLine(reading: Reading, from: number): string {
  const locale = reading.language
  const words = pickLocale(WORDS, locale, 'en')
  const method = getMethod(reading.method)
  if (method.kind === 'celtic') throw new RangeError(`describeTurn: ${method.id} is read a card at a time`)
  const turn = turnAt(reading, from)
  if (turn === undefined || from + turn.size > reading.drawn) throw new RangeError(`describeTurn: the line from card ${from + 1} has not been turned up`)
  const named = (p: Placed): string => {
    const name = cardName(getCard(p.cardId), locale)
    return p.reversed ? words.reversedName(name) : name
  }
  const lines = reading.turns.length
  const rtl = method.direction === 'right-to-left'
  const out: string[] = []

  if (from === 0) {
    if (method.kind === 'lines') {
      out.push(...words.linesStyle, '')
    } else {
      out.push(...words.continueStyle, '')
    }
    if (reading.question.trim() !== '') out.push(words.asks(reading.question.trim()), '')
    if (method.kind === 'lines') {
      if (reading.significator !== null) {
        out.push(words.querent(named(reading.significator)), ...meaningLines(getCard(reading.significator.cardId), reading.significator, '  ', words, locale), '')
      }
      for (const text of guidanceTexts(method, locale)) out.push(`${words.guidance}: ${text}`)
      out.push('')
    }
  }

  out.push(words.lineTurned(turn.turn + 1, lines, rtl))
  const position = method.kind === 'continuation' ? method.positions[turn.turn] : undefined
  if (position !== undefined) out.push(words.position(positionName(method.id, position, locale), positionMeaning(method.id, position, locale)))
  reading.order.slice(from, from + turn.size).forEach((placed, i) => {
    out.push(words.lineCard(i + 1, named(placed)), ...meaningLines(getCard(placed.cardId), placed, '  ', words, locale))
  })
  if (from > 0) {
    out.push('', words.table)
    let start = 0
    for (const [i, size] of reading.turns.slice(0, turn.turn).entries()) {
      out.push(`  ${words.lineName(i + 1)}: ${reading.order.slice(start, start + size).map(named).join(words.separator)}`)
      start += size
    }
  }
  out.push(...recurrenceLines(reading, from, turn.size, words))
  if (turn.turn + 1 === lines) out.push('', method.kind === 'lines' ? words.linesLast : words.continueLast)
  return out.join('\n')
}

/** The same for a plain draw: the card just turned and those already down, with no positions. */
function describePlain(reading: Reading, index: number): string {
  const locale = reading.language
  const words = pickLocale(WORDS, locale, 'en')
  const placed = reading.order[index]
  if (placed === undefined || index >= reading.drawn) throw new RangeError(`describeTurn: card ${index + 1} has not been turned up`)
  const named = (p: Placed): string => {
    const name = cardName(getCard(p.cardId), locale)
    return p.reversed ? words.reversedName(name) : name
  }
  const out: string[] = []
  if (index === 0) {
    out.push(...words.plainStyle, '')
    if (reading.question.trim() !== '') out.push(words.asks(reading.question.trim()), '')
  }
  out.push(words.plainTurned(index + 1, reading.draws, named(placed)), ...meaningLines(getCard(placed.cardId), placed, '  ', words, locale))
  if (index > 0) out.push('', words.table, ...reading.order.slice(0, index).map((p, i) => `  ${i + 1}. ${named(p)}`))
  out.push(...recurrenceLines(reading, index, 1, words))
  if (index + 1 === reading.draws) out.push('', words.plainLast)
  return out.join('\n')
}

/** The place card `index` of a layout lies in: its name, and what that place stands for. */
function layoutSlot(id: LayoutId, index: number, locale: string, words: Words): Slot {
  if (id === 'three') {
    // The book's own account of what is behind, around and before the person, here the one card each place has.
    const celtic = getMethod('celtic')
    const position = celtic.positions[[4, 0, 5][index]!]!
    return { name: words.threeSlots[index]!, meaning: positionMeaning(celtic.id, position, locale) }
  }
  const row = words.nineRows[Math.floor(index / 3)]!
  const column = words.nineColumns[index % 3]!
  const role = index === 4 ? words.nineCentre : index % 2 === 0 ? words.nineCorner : null
  return { name: words.nineCell(row.name, column.name), meaning: [`${row.meaning}; ${column.meaning}.`, role].filter(Boolean).join(' ') }
}

/** The same for a modern layout of three or nine cards: the card just turned, its place and the places already filled. */
function describeLayout(reading: Reading, id: LayoutId, index: number): string {
  const locale = reading.language
  const words = pickLocale(WORDS, locale, 'en')
  const placed = reading.order[index]
  if (placed === undefined || index >= reading.drawn) throw new RangeError(`describeTurn: card ${index + 1} has not been turned up`)
  const named = (p: Placed): string => {
    const name = cardName(getCard(p.cardId), locale)
    return p.reversed ? words.reversedName(name) : name
  }
  const slot = (i: number): Slot => layoutSlot(id, i, locale, words)
  const out: string[] = []
  if (index === 0) {
    out.push(...words.layoutStyle[id], '')
    if (reading.question.trim() !== '') out.push(words.asks(reading.question.trim()), '')
  }
  out.push(words.turned(index + 1, reading.draws, named(placed)))
  out.push(words.position(slot(index).name, slot(index).meaning), ...meaningLines(getCard(placed.cardId), placed, '  ', words, locale))
  if (index > 0) out.push('', words.table, ...reading.order.slice(0, index).map((p, i) => `  ${i + 1}. ${slot(i).name}: ${named(p)}`))
  out.push(...recurrenceLines(reading, index, 1, words))
  if (index + 1 === reading.draws) out.push('', words.layoutLast[id])
  return out.join('\n')
}

/** What to tell the model when the person ends a reading before its last card. */
export function describeEnd(reading: Reading): string {
  return pickLocale(WORDS, reading.language, 'en').ended(reading.drawn, reading.draws)
}

/** What to put in front of the model when the person turns up the next cards of a reading, from card `from`. */
export function describeTurn(reading: Reading, from: number): string {
  if (reading.method === PLAIN_METHOD) return describePlain(reading, from)
  if (isLayout(reading.method)) return describeLayout(reading, reading.method, from)
  return getMethod(reading.method).kind === 'celtic' ? describeCard(reading, from) : describeLine(reading, from)
}
