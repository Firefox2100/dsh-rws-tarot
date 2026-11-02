import raw from '../data/names.json' with { type: 'json' }
import type { Card, CelticMethod, LinesMethod, MethodPosition, Rank, Suit } from './types.ts'

interface Names {
  readonly major: Readonly<Record<string, string>>
  readonly suits: Readonly<Record<Suit, string>>
  readonly ranks: Readonly<Record<Rank, string>>
  readonly positions: Readonly<Record<string, readonly string[]>>
  readonly methods: Readonly<Record<string, {
    readonly positions?: readonly string[]
    readonly finalCard?: string
    readonly followUp?: Readonly<Record<string, string>>
    readonly guidance?: Readonly<Record<string, string>>
  }>>
}

const names: Readonly<Record<string, Names>> = raw as unknown as Record<string, Names>

/**
 * The entry of a per-language table for a locale id: the exact id, else its language part (`zh-CN` -> `zh`), else the
 * fallback. Used for every language-dependent table, so all of them resolve a locale the same way.
 */
export function pickLocale<T>(table: Readonly<Record<string, T>>, id: string | undefined, fallback: string): T {
  const language = id?.split(/[-_]/)[0]
  const found = (id === undefined ? undefined : table[id]) ?? (language === undefined ? undefined : table[language]) ?? table[fallback]
  if (found === undefined) throw new RangeError(`no entry for locale ${JSON.stringify(id)} or fallback ${JSON.stringify(fallback)}`)
  return found
}

function namesFor(locale: string | undefined): Names | undefined {
  const language = locale?.split(/[-_]/)[0]
  return (locale === undefined ? undefined : names[locale]) ?? (language === undefined ? undefined : names[language])
}

/** A card's name in the locale; the book's own English title where no translation exists. */
export function cardName(card: Card, locale: string | undefined): string {
  const table = namesFor(locale)
  if (table === undefined) return card.name
  if (card.arcana === 'major') return table.major[card.id] ?? card.name
  return card.suit === null || card.rank === null ? card.name : `${table.suits[card.suit]}${table.ranks[card.rank]}`
}

/** A position's name in the locale; the book's own words where no translation exists. */
export function positionName(methodId: string, position: MethodPosition, locale: string | undefined): string {
  return namesFor(locale)?.positions[methodId]?.[position.number - 1] ?? position.name
}

/** What a position means, in the locale; the book's own sentence where no translation exists. */
export function positionMeaning(methodId: string, position: MethodPosition, locale: string | undefined): string {
  return namesFor(locale)?.methods[methodId]?.positions?.[position.number - 1] ?? position.meaning
}

/** The book's guidance for the last card of a method, in the locale. */
export function finalCardText(method: CelticMethod, locale: string | undefined): string {
  return namesFor(locale)?.methods[method.id]?.finalCard ?? method.finalCard.text
}

/** The text of each of a method's follow-up rules, in the locale. */
export function followUpTexts(method: CelticMethod, locale: string | undefined): string[] {
  const table = namesFor(locale)?.methods[method.id]?.followUp
  return method.followUp.map(f => table?.[f.id] ?? f.text)
}

/** The text of each of a lines method's guidance sentences, in the locale. */
export function guidanceTexts(method: LinesMethod, locale: string | undefined): string[] {
  const table = namesFor(locale)?.methods[method.id]?.guidance
  return method.guidance.map(g => table?.[g.id] ?? g.text)
}
