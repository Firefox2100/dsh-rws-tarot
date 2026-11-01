export type Arcana = 'major' | 'minor'
export type Suit = 'wands' | 'cups' | 'swords' | 'pentacles'
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

export interface Method {
  readonly id: string
  readonly name: string
  readonly source: Source
  readonly purpose: Passage
  readonly deck: 'full'
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
