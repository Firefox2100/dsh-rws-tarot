import type { Placed } from './pack.ts'

/**
 * One reading on the table. `order` is the whole pack as it lay when the reading began, so a replay needs no
 * random numbers; `drawn` counts the cards turned up so far, at most `draws`.
 */
export interface Reading {
  readonly id: string
  readonly method: string
  /** The card chosen to stand for the person or matter, laid face up before the draw; null for methods without one. */
  readonly significator: Placed | null
  /** The side the Significator faces, which decides where the book's fifth and sixth cards go. */
  readonly facing: 'left' | 'right' | null
  /** What the Querent asks, in their own words; empty when nothing was asked. */
  readonly question: string
  /** The language the reading is held in, from the screen it was begun on; the facts reach the model in it. */
  readonly language: string
  /** How many cards the reading turns up in all. */
  readonly draws: number
  /** How many cards each turn shows, in order, adding up to `draws`: one each for a spread read position by position, a line each for a layout read line by line. */
  readonly turns: number[]
  readonly order: Placed[]
  readonly drawn: number
  /** Whether the person ended the reading before its last card; it then takes no more cards and is never carried on. */
  readonly abandoned: boolean
}

/** Every reading of one conversation, oldest first. Plain JSON, rebuilt by replaying the records below. */
export interface Table {
  readonly readings: Reading[]
}

export interface StartEvent extends Omit<Reading, 'drawn' | 'abandoned'> {}

export interface AbandonEvent {
  readonly readingId: string
}

export interface DrawEvent {
  readonly readingId: string
  /** Position in the pack of the card turned up; must be the next one, so a replay cannot skip or repeat a card. */
  readonly index: number
}

/** The turn that begins at card `from` (0-based) and how many cards it shows; undefined when no turn begins there. */
export function turnAt(reading: Pick<Reading, 'turns'>, from: number): { turn: number, size: number } | undefined {
  let start = 0
  for (const [turn, size] of reading.turns.entries()) {
    if (start === from) return { turn, size }
    start += size
  }
  return undefined
}

export const emptyTable: Table = { readings: [] }

/** Records that do not follow on from the table are ignored, never thrown: the log is replayed on load. */
export function applyStart(table: Table, event: StartEvent): Table {
  if (table.readings.some(r => r.id === event.id)) return table
  return { readings: [...table.readings, { ...event, drawn: 0, abandoned: false }] }
}

export function applyDraw(table: Table, event: DrawEvent): Table {
  const at = table.readings.findIndex(r => r.id === event.readingId)
  const reading = table.readings[at]
  const turn = reading === undefined ? undefined : turnAt(reading, event.index)
  if (reading === undefined || reading.abandoned || turn === undefined || event.index !== reading.drawn || event.index + turn.size > reading.order.length) return table
  const readings = table.readings.slice()
  readings[at] = { ...reading, drawn: reading.drawn + turn.size }
  return { readings }
}

/** Ends a reading that is still open; one already finished or ended is left as it is. */
export function applyAbandon(table: Table, event: AbandonEvent): Table {
  const at = table.readings.findIndex(r => r.id === event.readingId)
  const reading = table.readings[at]
  if (reading === undefined || reading.abandoned || reading.drawn >= reading.draws) return table
  const readings = table.readings.slice()
  readings[at] = { ...reading, abandoned: true }
  return { readings }
}
