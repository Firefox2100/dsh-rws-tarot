export type Arcana = 'major' | 'minor'
export type Suit = 'wands' | 'cups' | 'swords' | 'pentacles'
/** What the book says of two, three or four cards of one rank turning up together, upright (natural) or reversed. */
export interface Recurrence {
  readonly rank: Rank
  readonly count: 2 | 3 | 4
  readonly position: 'natural' | 'reversed'
  /** The book's phrase, such as `3 Kings = consultation`. */
  readonly text: string
  /** What it signifies, such as `consultation`. */
  readonly means: string
  readonly pdfPage: number
}

export type Rank = 'ace' | 'two' | 'three' | 'four' | 'five' | 'six' | 'seven' | 'eight' | 'nine' | 'ten' | 'page' | 'knight' | 'queen' | 'king'

/** Where in the book a text stands; `pdfPages` index the page-scan PDF kept under `references/`. */
export interface Source {
  readonly part: number
  readonly section?: string
  readonly pdfPages: readonly [number, number]
}

export interface Passage {
  readonly text: string
  readonly source: Source
}

export interface Meaning extends Passage {
  readonly scenario: 'upright' | 'reversed'
  readonly context: 'divinatory' | 'additional'
}

export interface CardImage {
  readonly file: string
  readonly width: number
  readonly height: number
  readonly sha256: string
  readonly source: string
}

export interface Card {
  /** `major-00`..`major-21`, `wands-01`..`pentacles-14` (11 page, 12 knight, 13 queen, 14 king). */
  readonly id: string
  readonly arcana: Arcana
  readonly number: number
  readonly suit: Suit | null
  readonly rank: Rank | null
  readonly name: string
  readonly aliases?: readonly string[]
  readonly printedTitle: string
  readonly image: CardImage
  readonly pictorial: Passage | null
  readonly traditional: Passage | null
  readonly meanings: readonly Meaning[]
}

export interface SectionNote {
  readonly id: string
  readonly text: string
  readonly source: Source
}

export interface TarotData {
  readonly book: { readonly title: string, readonly author: string, readonly illustrator: string, readonly year: string, readonly pageNote: string }
  readonly sectionNotes: readonly SectionNote[]
  readonly cards: readonly Card[]
}

export interface MethodPosition {
  readonly number: number
  readonly name: string
  /** What the Diviner says as the card is turned up, where the book gives it. */
  readonly say: string | null
  /** How the book says to lay the card, where it says so. */
  readonly place: string | null
  readonly meaning: string
  readonly source: Source
}

interface MethodBase {
  readonly id: string
  readonly name: string
  readonly source: Source
  readonly purpose: Passage
  readonly deck: 'full'
}

/** A method that deals a Significator and then reads ten named positions, one card each. */
export interface CelticMethod extends MethodBase {
  readonly kind: 'celtic'
  readonly significator: {
    readonly definition: Passage
    readonly ofPerson: readonly (Passage & { readonly rank: Rank })[]
    readonly colouring: readonly (Passage & { readonly suit: Suit })[]
    readonly reserve: Passage
    readonly ofMatter: Passage
  }
  readonly preparation: Passage & { readonly shuffleAndCutTimes: number }
  readonly facing: Passage
  readonly positions: readonly MethodPosition[]
  readonly cross: Passage
  readonly finalCard: Passage
  readonly followUp: readonly (Passage & { readonly id: string })[]
}

/** A method that deals the whole layout at once, in lines with no meaning of their own, and reads it card by card. */
export interface LinesMethod extends MethodBase {
  readonly kind: 'lines'
  /** What the Querent may name before the shuffle: a period the reading is about. */
  readonly period: Passage
  readonly preparation: Passage
  readonly cut: Passage
  readonly dealing: Passage & { readonly packets: number, readonly perPacket: number }
  readonly regrouping: Passage
  /** How the regrouped packets are shuffled and laid out, top of the packets first. */
  readonly layout: readonly (Passage & { readonly lines: number, readonly fromEach: number })[]
  readonly querent: Passage & {
    readonly male: string
    readonly female: string
    readonly notDealt: Passage
    readonly dealt: Passage
  }
  readonly reading: Passage
  /** The side each line is read from. */
  readonly direction: 'right-to-left' | 'left-to-right'
  readonly guidance: readonly (Passage & { readonly id: string })[]
}

/** A method that carries a finished reading further with the cards left over, laid in lines of unequal length that each have a meaning. */
export interface ContinuationMethod extends MethodBase {
  readonly kind: 'continuation'
  /** The method whose finished reading it continues. */
  readonly continues: string
  readonly heap: Passage
  /** The packets the remaining cards are dealt into, and how many cards each holds; each becomes one line. */
  readonly packets: Passage & { readonly sizes: readonly number[] }
  readonly layout: Passage
  /** The lines, in order, with what the book says each stands for. */
  readonly positions: readonly MethodPosition[]
  readonly reading: Passage
  readonly direction: 'right-to-left' | 'left-to-right'
}

export type Method = CelticMethod | LinesMethod | ContinuationMethod
