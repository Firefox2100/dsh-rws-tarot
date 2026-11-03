import { useState, type CSSProperties } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { cardName, cards, getCard, getMethod, positionMeaning, positionName, type MethodPosition, type Suit } from '@dsh-rws-tarot/data'
import { LAYOUT_SIZES, PLAIN_LIMIT, significatorFor, type Person, type Placed } from '@dsh-rws-tarot/engine'
import type { ReadingView } from '../types.ts'
import { plateUrl } from './plates.ts'
import type { TarotInjected } from './index.ts'
import css from './TarotPage.module.css'

type Props = PropsRuntime<'sidebar.right.pane.tab'> & InjectFace<TarotInjected> & PropsLocale<'tarot'>
type T = Props['t']
/** A card's name in the language of the screen. */
type NameOf = (cardId: string) => string

const COUNTS = Array.from({ length: PLAIN_LIMIT }, (_, i) => i + 1)
const SUITS: readonly Suit[] = ['wands', 'cups', 'swords', 'pentacles']
const DEFAULT_MAX_QUESTION = 500

/** A method that begins from the person's own choices; the continuation has none. */
type Chosen = 'celtic' | 'alternative' | 'plain' | 'three' | 'nine'
type MethodId = Chosen | 'thirtyfive'

const cx = (...names: (string | false | undefined)[]): string => names.filter(Boolean).join(' ')

/**
 * Grid cell (column, row) of each Celtic Cross position in the traditional diagram. The Significator faces left there;
 * facing right swaps the fifth and sixth cards. Cards 7 to 10 stand in a column on the right, the seventh at the foot.
 */
function cell(position: number, facing: 'left' | 'right'): { col: number; row: number } {
  switch (position) {
    case 1: case 2: return { col: 2, row: 2 }
    case 3: return { col: 2, row: 1 }
    case 4: return { col: 2, row: 3 }
    case 5: return { col: facing === 'left' ? 3 : 1, row: 2 }
    case 6: return { col: facing === 'left' ? 1 : 3, row: 2 }
    default: return { col: 4, row: 11 - position }
  }
}

function Face({ placed, label }: { placed: Placed; label: string }) {
  return <img className={cx(css.plate, placed.reversed && css.upside)} src={plateUrl(getCard(placed.cardId))} alt={label} draggable={false} />
}

interface BoardProps {
  positions: readonly MethodPosition[]
  facing: 'left' | 'right'
  significator: Placed | null
  drawn: readonly Placed[]
  next: number | null
  busy: boolean
  onTurn: () => void
  nameOf: NameOf
  t: T
}

/** The spread as it lies: the Significator face up, every other card face down until it is turned over. */
function Board({ positions, facing, significator, drawn, next, busy, onTurn, nameOf, t }: BoardProps) {
  return (
    <div className={css.board}>
      {significator !== null && (
        <div className={cx(css.slot, css.significator)} style={{ gridColumn: 2, gridRow: 2 }} title={`${t('significator.chosen', { name: nameOf(significator.cardId) })}. ${t('significator.help')}`}>
          <span className={css.still}><Face placed={significator} label={t('significator.chosen', { name: nameOf(significator.cardId) })} /></span>
        </div>
      )}
      {positions.map((position) => {
        const index = position.number - 1
        const placed = drawn[index]
        // The crossing card lies on the first one, so it is laid down only once the first is turned.
        if (position.number === 2 && drawn.length === 0) return null
        const at = cell(position.number, facing)
        const isNext = index === next
        const name = placed === undefined ? '' : nameOf(placed.cardId)
        const label = placed === undefined
          ? t(isNext ? 'card.turn' : 'card.back', { n: position.number, position: position.name })
          : `${position.number}. ${position.name}: ${name}, ${t(placed.reversed ? 'reversed' : 'upright')}`
        return (
          <div key={position.number} className={cx(css.slot, position.number === 2 && css.crossing)} style={{ gridColumn: at.col, gridRow: at.row }}>
            <button
              type="button"
              className={cx(css.card, placed !== undefined && css.flipped, isNext && css.next)}
              disabled={!isNext || busy}
              aria-label={label}
              title={position.name}
              onClick={onTurn}
            >
              <span className={css.inner}>
                <span className={css.back}><span className={css.number}>{position.number}</span></span>
                <span className={css.front}>
                  {placed !== undefined && <Face placed={placed} label={label} />}
                </span>
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

interface LinesBoardProps {
  /** How many cards each line holds. */
  rows: readonly number[]
  /** Whether a line is read from its right, which is where its first card lies. */
  rightToLeft: boolean
  querent: Placed | null
  drawn: readonly Placed[]
  next: number | null
  busy: boolean
  onTurn: () => void
  nameOf: NameOf
  t: T
}

/** The layout as it lies: lines of cards, each read from one end, the next line turning as one; the Querent's card beside the first line when it has a place. */
function LinesBoard({ rows, rightToLeft, querent, drawn, next, busy, onTurn, nameOf, t }: LinesBoardProps) {
  const width = Math.max(...rows)
  const starts = rows.map((_, i) => rows.slice(0, i).reduce((a, b) => a + b, 0))
  const nextLine = next === null ? null : starts.findIndex(start => start === next)
  const columns = querent === null ? `repeat(${width}, minmax(44px, 1fr))` : `repeat(${width}, minmax(44px, 1fr)) 8px minmax(44px, 1fr)`
  return (
    <div className={css.layout} style={{ gridTemplateColumns: columns }}>
      {querent !== null && (
        <div className={css.slot} style={{ gridColumn: width + 2, gridRow: 1 }} title={`${t('querent.chosen', { name: nameOf(querent.cardId) })}. ${t('querent.help')}`}>
          <span className={css.still}><Face placed={querent} label={t('querent.chosen', { name: nameOf(querent.cardId) })} /></span>
        </div>
      )}
      {rows.flatMap((count, row) => Array.from({ length: count }, (_, k) => {
        const index = starts[row]! + k
        const line = row + 1
        const n = k + 1
        const placed = drawn[index]
        const isNext = row === nextLine
        const where = { line, n }
        const label = placed === undefined
          ? t(isNext ? 'line.turn' : 'line.back', where)
          : `${t('line.label', where)}: ${nameOf(placed.cardId)}, ${t(placed.reversed ? 'reversed' : 'upright')}`
        return (
          <div key={index} className={css.slot} style={{ gridColumn: rightToLeft ? width + 1 - n : n, gridRow: line }}>
            <button
              type="button"
              className={cx(css.card, placed !== undefined && css.flipped, isNext && css.next)}
              style={{ '--i': k } as CSSProperties}
              disabled={!isNext || busy}
              aria-label={label}
              title={t('line.label', where)}
              onClick={onTurn}
            >
              <span className={css.inner}>
                <span className={css.back}><span className={css.number}>{n}</span></span>
                <span className={css.front}>
                  {placed !== undefined && <Face placed={placed} label={label} />}
                </span>
              </span>
            </button>
          </div>
        )
      }))}
    </div>
  )
}

interface PlainBoardProps {
  count: number
  /** How many cards stand in a row. */
  columns: number
  /** The place card `index` lies in, shown under the card when the layout has named places. */
  slotName: (index: number) => string
  captioned: boolean
  drawn: readonly Placed[]
  next: number | null
  busy: boolean
  onTurn: () => void
  nameOf: NameOf
  t: T
}

/** A draw without the book's positions as it lies (a plain draw, three cards or nine): cards in rows, turned one at a time from the first. */
function PlainBoard({ count, columns, slotName, captioned, drawn, next, busy, onTurn, nameOf, t }: PlainBoardProps) {
  return (
    <div className={cx(css.layout, captioned && css.captioned)} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }, (_, index) => {
        const n = index + 1
        const placed = drawn[index]
        const isNext = index === next
        const label = placed === undefined
          ? t(isNext ? 'plain.turn' : 'plain.back', { n })
          : `${slotName(index)}: ${nameOf(placed.cardId)}, ${t(placed.reversed ? 'reversed' : 'upright')}`
        return (
          <div key={index} className={css.slot}>
            <button
              type="button"
              className={cx(css.card, placed !== undefined && css.flipped, isNext && css.next)}
              disabled={!isNext || busy}
              aria-label={label}
              title={slotName(index)}
              onClick={onTurn}
            >
              <span className={css.inner}>
                <span className={css.back}><span className={css.number}>{n}</span></span>
                <span className={css.front}>
                  {placed !== undefined && <Face placed={placed} label={label} />}
                </span>
              </span>
            </button>
            {captioned && <span className={css.caption}>{slotName(index)}</span>}
          </div>
        )
      })}
    </div>
  )
}

interface TurnedProps {
  reading: ReadingView
  /** The place each turned card lies in, and what the book says of that place when it does. */
  where: (index: number) => { name: string; meaning: string | null }
  nameOf: NameOf
  t: T
}

function Turned({ reading, where, nameOf, t }: TurnedProps) {
  if (reading.drawn.length === 0) return null
  return (
    <details className={css.turned}>
      <summary>{t('cards')}</summary>
      <ol className={css.list}>
        {reading.drawn.map((placed, i) => {
          const card = getCard(placed.cardId)
          const scenario = placed.reversed ? 'reversed' : 'upright'
          const meanings = card.meanings.filter(m => m.scenario === scenario)
          return (
            <li key={i}>
              <details>
                <summary>
                  <span className={css.summaryNumber}>{i + 1}</span>
                  <span>{where(i).name}</span>
                  <span className={css.muted}>{nameOf(card.id)} · {t(placed.reversed ? 'reversed' : 'upright')}</span>
                </summary>
                {where(i).meaning !== null && <p className={css.quote}><em>{t('position.meaning')}:</em> {where(i).meaning}</p>}
                {meanings.filter(m => m.context === 'divinatory').map((m, k) => <p key={`d${k}`}><strong>{t('card.meaning')}.</strong> {m.text}</p>)}
                {!meanings.some(m => m.context === 'divinatory') && <p className={css.muted}>{t('card.none')}</p>}
                {meanings.filter(m => m.context === 'additional').map((m, k) => <p key={`a${k}`}><strong>{t('card.also')}.</strong> {m.text}</p>)}
              </details>
            </li>
          )
        })}
      </ol>
    </details>
  )
}

/** A place of a layout of modern practice and what the book says of the position it borrows. */
interface Place { number: number; name: string; meaning: string }

interface Options {
  mode: 'person' | 'card'
  person: Person
  suit: Suit
  picked: string
  facing: 'left' | 'right'
  /** Whether cards may come up reversed, per method: the Celtic Cross turns none, the alternative method turns some. */
  reversals: Record<Chosen, boolean>
  /** How many cards a plain draw turns up. */
  count: number
}

const initialOptions: Options = { mode: 'person', person: { sex: 'female', fortyOrOver: false }, suit: 'wands', picked: 'major-00', facing: 'left', reversals: { celtic: false, alternative: true, plain: false, three: false, nine: false }, count: 3 }

export function startCommand(methodId: MethodId, question: string, count: number, language: string, significatorId: string | null, options: Options): string {
  const asked = question.replace(/\s+/g, ' ').trim()
  const orientation = methodId !== 'thirtyfive' && options.reversals[methodId] ? 'reversed' : 'upright'
  const command = methodId === 'thirtyfive'
    ? `/tarot continue ${asked}`
    : methodId === 'plain'
      ? `/tarot start plain ${count} ${orientation} ${language} ${asked}`
      : methodId === 'three' || methodId === 'nine'
      ? `/tarot start ${methodId} ${orientation} ${language} ${asked}`
      : methodId === 'alternative'
        ? `/tarot start alternative ${options.person.sex} ${orientation} ${language} ${asked}`
        : `/tarot start celtic ${significatorId} ${options.facing} ${orientation} ${language} ${asked}`
  return command.trim()
}

function OptionsPanel({ methodId, value, onChange, nameOf, t }: { methodId: Chosen; value: Options; onChange: (next: Options) => void; nameOf: NameOf; t: T }) {
  const [cardSearch, setCardSearch] = useState('')
  const method = getMethod('celtic')
  const lines = methodId === 'alternative'
  const normalizedSearch = cardSearch.trim().toLocaleLowerCase()
  const matchingCards = cards.filter(card => normalizedSearch === '' || card.id.includes(normalizedSearch) || nameOf(card.id).toLocaleLowerCase().includes(normalizedSearch))
  const sex = (name: string) => (
    <div className={css.row}>
      <span>{t('significator.sex')}</span>
      {radio(name, value.person.sex === 'male', () => { set({ person: { ...value.person, sex: 'male' } }) }, t('significator.male'))}
      {radio(name, value.person.sex === 'female', () => { set({ person: { ...value.person, sex: 'female' } }) }, t('significator.female'))}
    </div>
  )
  const set = (patch: Partial<Options>): void => { onChange({ ...value, ...patch }) }
  const radio = (name: string, on: boolean, change: () => void, label: string) => (
    <label className={css.choice}><input type="radio" name={name} checked={on} onChange={change} />{label}</label>
  )
  return (
    <div className={css.options}>
      <section>
        <h4>{t('deck.title')}</h4>
        <select disabled value="full" aria-label={t('deck.title')}><option value="full">{t('deck.full')}</option></select>
      </section>
      {methodId === 'plain' || methodId === 'three' || methodId === 'nine' ? null : lines ? (
        <section>
          <h4>{t('querent.title')}</h4>
          <p className={css.muted}>{t('querent.help')}</p>
          {sex('querentSex')}
          <p className={css.muted}>{getMethod('alternative').querent.text}</p>
        </section>
      ) : (
      <section>
        <h4>{t('significator.title')}</h4>
        <p className={css.muted}>{t('significator.help')}</p>
        <div className={css.row}>
          {radio('mode', value.mode === 'person', () => { set({ mode: 'person' }) }, t('significator.person'))}
          {radio('mode', value.mode === 'card', () => { set({ mode: 'card' }) }, t('significator.card'))}
        </div>
        {value.mode === 'person' ? (
          <>
            {sex('sex')}
            <div className={css.row}>
              <span>{t('significator.age')}</span>
              {radio('age', !value.person.fortyOrOver, () => { set({ person: { ...value.person, fortyOrOver: false } }) }, t('significator.under40'))}
              {radio('age', value.person.fortyOrOver, () => { set({ person: { ...value.person, fortyOrOver: true } }) }, t('significator.over40'))}
            </div>
            <div className={css.colouring}>
              <span>{t('significator.colouring')}</span>
              {SUITS.map((s) => {
                const rule = method.significator.colouring.find(c => c.suit === s)!
                return (
                  <label key={s} className={css.choice}>
                    <input type="radio" name="suit" aria-label={t(`suit.${s}`)} checked={value.suit === s} onChange={() => { set({ suit: s }) }} />
                    <span><strong>{t(`suit.${s}`)}</strong> <span className={css.muted}>{rule.text}</span></span>
                  </label>
                )
              })}
              <p className={css.muted}>{method.significator.reserve.text}</p>
            </div>
          </>
        ) : (
          <div className={css.cardPicker}>
            <div className={css.cardPreview}>
              <img src={plateUrl(getCard(value.picked))} alt="" draggable={false} />
              <strong>{nameOf(value.picked)}</strong>
            </div>
            <input type="search" value={cardSearch} placeholder={t('significator.search')} onChange={(e) => { setCardSearch(e.target.value) }} />
            <select size={Math.min(8, Math.max(2, matchingCards.length))} value={value.picked} onChange={(e) => { set({ picked: e.target.value }) }} aria-label={t('significator.pick')}>
              {matchingCards.length === 0
                ? <option disabled>{t('significator.noMatches')}</option>
                : matchingCards.map(card => <option key={card.id} value={card.id}>{nameOf(card.id)}</option>)}
            </select>
          </div>
        )}
        <div className={css.row}>
          <span>{t('significator.facing')}</span>
          {radio('facing', value.facing === 'left', () => { set({ facing: 'left' }) }, t('significator.left'))}
          {radio('facing', value.facing === 'right', () => { set({ facing: 'right' }) }, t('significator.right'))}
        </div>
        <p className={css.muted}>{t('significator.facingHelp')} {method.facing.text}</p>
      </section>
      )}
      <section>
        <h4>{t('reversed.title')}</h4>
        {radio('rev', !value.reversals[methodId], () => { set({ reversals: { ...value.reversals, [methodId]: false } }) }, t(lines ? 'reversed.offLines' : 'reversed.off'))}
        {radio('rev', value.reversals[methodId], () => { set({ reversals: { ...value.reversals, [methodId]: true } }) }, t(methodId === 'alternative' ? 'reversed.onLines' : 'reversed.on'))}
      </section>
    </div>
  )
}

function MethodGuide({ methodId, positions, linePositions, threePositions, t }: { methodId: MethodId; positions: readonly MethodPosition[]; linePositions: readonly MethodPosition[]; threePositions: readonly Place[]; t: T }) {
  const items: readonly { number: number; name: string; meaning: string }[] = methodId === 'celtic' ? positions : methodId === 'thirtyfive' ? linePositions : methodId === 'three' ? threePositions : []
  return (
    <details className={css.guide}>
      <summary>{t('guide.title')}</summary>
      <p>{t(`guide.${methodId}`)}</p>
      {items.length > 0 && (
        <ol>
          {items.map(position => <li key={position.number}><strong>{position.name}</strong><span>{position.meaning}</span></li>)}
        </ol>
      )}
    </details>
  )
}

function Completion({ reading, canContinue, repeatCard, methodLabel, nameOf, onContinue, onRepeat, onNew, busy, t }: { reading: ReadingView; canContinue: boolean; repeatCard: string | null; methodLabel: string; nameOf: NameOf; onContinue: () => void; onRepeat: () => void; onNew: () => void; busy: boolean; t: T }) {
  return (
    <section className={css.completion}>
      <div>
        <h3>{t('complete.title')}</h3>
        <p>{methodLabel}{reading.question === '' ? '' : ` · ${reading.question}`}</p>
      </div>
      <div className={css.recap} aria-label={t('complete.cards')}>
        {reading.drawn.map((placed, index) => (
          <img key={index} className={placed.reversed ? css.upside : undefined} src={plateUrl(getCard(placed.cardId))} alt={nameOf(placed.cardId)} title={nameOf(placed.cardId)} draggable={false} />
        ))}
      </div>
      <p className={css.muted}>{t('complete.help')}</p>
      {repeatCard !== null && <p className={css.muted}>{t('complete.repeatHelp')}</p>}
      <div className={css.actions}>
        {canContinue && <Button variant="outline" size="sm" onClick={onContinue}>{t('complete.continue')}</Button>}
        {repeatCard !== null && <Button variant="outline" size="sm" disabled={busy} onClick={onRepeat}>{t('complete.repeat', { name: nameOf(repeatCard) })}</Button>}
        <Button variant="outline" size="sm" onClick={onNew}>{t('newReading')}</Button>
      </div>
    </section>
  )
}

/**
 * The tarot page of the right dock: pick how to draw, then click the glowing card and it turns over and is read in the
 * conversation. Every card shown comes from the reading the host keeps in the session, so a reload shows the same table.
 */
export function TarotPage({ useProjection, run, t }: Props) {
  const view = useProjection('tarot')
  const [chosenId, setChosenId] = useState<MethodId>('celtic')
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<Options>(initialOptions)
  const [fresh, setFresh] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const language = t('language')
  const maxQuestion = view?.maxQuestion ?? DEFAULT_MAX_QUESTION
  const nameOf: NameOf = cardId => cardName(getCard(cardId), language)
  const celtic = getMethod('celtic')
  const alternative = getMethod('alternative')
  const continuation = getMethod('thirtyfive')
  const positions = celtic.positions.map(p => ({ ...p, name: positionName(celtic.id, p, language), meaning: positionMeaning(celtic.id, p, language) }))
  const linePositions = continuation.positions.map(p => ({ ...p, name: positionName(continuation.id, p, language), meaning: positionMeaning(continuation.id, p, language) }))
  /** Past, present and future take the book's account of the card behind him, the one that covers him and the one before him. */
  const threePlaces: Place[] = ([['three.past', 5], ['three.present', 1], ['three.future', 6]] as const).map(([key, number], i) => {
    const position = celtic.positions.find(p => p.number === number)!
    return { number: i + 1, name: t(key), meaning: positionMeaning(celtic.id, position, language) }
  })
  const nineCell = (index: number): string => t('nine.cell', {
    row: t((['nine.thought', 'nine.reality', 'nine.undercurrent'] as const)[Math.floor(index / 3)]!),
    column: t((['three.past', 'three.present', 'nine.near'] as const)[index % 3]!),
  })
  const last = view?.readings.at(-1)
  const finished = last !== undefined && last.drawn.length >= last.draws
  const reading = last !== undefined && !last.abandoned && !(fresh && finished) ? last : undefined
  const canContinue = finished && last.method === continuation.continues
  /** The book's follow-up to a Celtic Cross: its tenth card taken as the Significator of a fresh one. */
  const repeatCard = finished && last.method === 'celtic' ? last.drawn[9]?.cardId ?? null : null
  const methodId: MethodId = reading === undefined
    ? chosenId === 'thirtyfive' && !canContinue ? 'celtic' : chosenId
    : reading.method === 'alternative' || reading.method === 'thirtyfive' || reading.method === 'plain' || reading.method === 'three' || reading.method === 'nine' ? reading.method : 'celtic'
  const lines = methodId === 'alternative' || methodId === 'thirtyfive'
  const plain = methodId === 'plain'
  const free = plain || methodId === 'three' || methodId === 'nine'
  const rows: readonly number[] = methodId === 'thirtyfive'
    ? reading?.turns ?? continuation.packets.sizes
    : Array.from({ length: alternative.dealing.packets }, () => alternative.dealing.perPacket)
  const count = reading !== undefined ? reading.draws : plain ? options.count : methodId === 'three' || methodId === 'nine' ? LAYOUT_SIZES[methodId] : 0
  const total = free ? count : lines ? rows.reduce((a, b) => a + b, 0) : positions.length
  const drawn = reading?.drawn ?? []
  const next = drawn.length < total ? drawn.length : null
  const facing = reading?.facing ?? options.facing
  const significator: Placed | null = reading !== undefined
    ? reading.significator
    : methodId === 'thirtyfive'
      ? last?.significator ?? null
      : free
        ? null
      : methodId === 'alternative'
        ? { cardId: options.person.sex === 'male' ? alternative.querent.male : alternative.querent.female, reversed: false }
        : { cardId: options.mode === 'person' ? significatorFor(options.person, options.suit) : options.picked, reversed: false }
  /** The line a card lies in, from 0, and its place in it from 1. */
  const lineOf = (index: number): { row: number; n: number } => {
    let row = 0
    let start = 0
    while (row < rows.length - 1 && index >= start + rows[row]!) start += rows[row++]!
    return { row, n: index - start + 1 }
  }
  /** The place card `index` of a reading lies in, and what the book says of that place when it does. */
  const whereIn = (r: ReadingView) => (index: number): { name: string; meaning: string | null } => {
    if (r.method === 'plain') return { name: t('plain.card', { n: index + 1 }), meaning: null }
    if (r.method === 'three') return { name: threePlaces[index]!.name, meaning: threePlaces[index]!.meaning }
    if (r.method === 'nine') return { name: nineCell(index), meaning: null }
    if (r.method === 'celtic') return { name: positions[index]!.name, meaning: positions[index]!.meaning }
    let row = 0
    let start = 0
    while (row < r.turns.length - 1 && index >= start + r.turns[row]!) start += r.turns[row++]!
    return { name: t('line.label', { line: row + 1, n: index - start + 1 }), meaning: r.method === 'thirtyfive' ? linePositions[row]!.meaning : null }
  }
  const earlier = (view?.readings ?? []).filter(r => r !== reading).reverse()
  const methodLabel = (id: string): string => t(id === 'alternative' ? 'method.alt42' : id === 'thirtyfive' ? 'method.alt35' : id === 'plain' ? 'method.plain' : id === 'three' ? 'method.three' : id === 'nine' ? 'method.nine' : 'method.celtic')

  const turn = async (): Promise<void> => {
    if (next === null) return
    setBusy(true)
    setError(null)
    try {
      if (reading === undefined) {
        const failure = await run(startCommand(methodId, question, count, language, significator?.cardId ?? null, options))
        if (failure !== null) { setError(failure); return }
        setFresh(false)
      }
      const failure = await run('/tarot draw')
      if (failure !== null) setError(failure)
    } finally { setBusy(false) }
  }
  const end = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const failure = await run('/tarot abandon')
      if (failure !== null) setError(failure)
      else { setQuestion(''); setChosenId(methodId) }
    } finally { setBusy(false) }
  }
  const repeat = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const failure = await run(`/tarot repeat ${options.reversals.celtic ? 'reversed' : 'upright'}`)
      if (failure !== null) setError(failure)
      else { setFresh(false); setChosenId('celtic') }
    } finally { setBusy(false) }
  }
  const nextRow = next === null ? 0 : lineOf(next).row
  const progress = lines
    ? t('progress.lines', { n: next === null ? rows.length : nextRow, m: rows.length })
    : t('progress.cards', { n: drawn.length, m: total })
  const instruction = busy
    ? t('hint.busy')
    : next === null
      ? t(lines || free ? 'hint.doneLines' : 'hint.done')
      : reading === undefined
        ? t(free ? 'hint.begin' : lines ? 'hint.beginLines' : 'hint.begin')
        : free ? t('hint.nextPlain', { n: next + 1 }) : lines ? t('hint.nextLine', { line: nextRow + 1 }) : t('hint.next', { position: positions[next]!.name })
  const onTurn = (): void => { void turn() }

  return (
    <div className={css.page} aria-busy={busy}>
      <div className={css.top}>
        <label className={css.field}>
          <span>{t('how.label')}</span>
          <select value={methodId} onChange={(e) => { setChosenId(['alternative', 'thirtyfive', 'plain', 'three', 'nine'].includes(e.target.value) ? e.target.value as MethodId : 'celtic'); setFresh(true) }} disabled={reading !== undefined && !finished}>
            <option value="celtic">{t('method.celtic')} — {t('method.celtic.detail')}</option>
            <option value="alternative">{t('method.alt42')} — {t('method.alt42.detail')}</option>
            <option value="thirtyfive" disabled={!canContinue && methodId !== 'thirtyfive'}>
              {t('method.alt35')} — {t('method.alt35.detail')}{!canContinue && methodId !== 'thirtyfive' ? ` (${t('method.needsAlt')})` : ''}
            </option>
            <option value="plain">{t('method.plain')} — {t('method.plain.detail')}</option>
            <option value="three">{t('method.three')} — {t('method.three.detail')}</option>
            <option value="nine">{t('method.nine')} — {t('method.nine.detail')}</option>
          </select>
        </label>
        {plain && (
          <label className={css.field}>
            <span>{t('plain.count')}</span>
            {reading === undefined
              ? (
                <select value={options.count} onChange={(e) => { setOptions({ ...options, count: Number(e.target.value) }) }}>
                  {COUNTS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              )
              : <p className={css.asked}>{reading.draws}</p>}
          </label>
        )}
        <label className={css.field}>
          <span>{t('question.label')}</span>
          {reading === undefined
            ? <textarea rows={2} value={question} maxLength={maxQuestion} placeholder={t(methodId === 'thirtyfive' ? 'question.placeholderContinue' : lines ? 'question.placeholderLines' : 'question.placeholder')} onChange={(e) => { setQuestion(e.target.value) }} />
            : <p className={css.asked}>{reading.question === '' ? '—' : reading.question}</p>}
        </label>
      </div>

      {reading === undefined && <MethodGuide methodId={methodId} positions={positions} linePositions={linePositions} threePositions={threePlaces} t={t} />}

      <div className={css.progress} role="status" aria-live="polite">
        <span className={css.progressCount}>{progress}</span>
        <span>{instruction}</span>
      </div>

      {free
        ? <PlainBoard count={count} columns={plain ? Math.min(count, 6) : 3} slotName={methodId === 'three' ? i => threePlaces[i]!.name : methodId === 'nine' ? nineCell : n => t('plain.card', { n: n + 1 })} captioned={!plain} drawn={drawn} next={next} busy={busy} onTurn={onTurn} nameOf={nameOf} t={t} />
        : lines
        ? <LinesBoard rows={rows} rightToLeft={(methodId === 'alternative' ? alternative : continuation).direction === 'right-to-left'} querent={methodId === 'alternative' ? significator : null} drawn={drawn} next={next} busy={busy} onTurn={onTurn} nameOf={nameOf} t={t} />
        : <Board positions={positions} facing={facing} significator={significator} drawn={drawn} next={next} busy={busy} onTurn={onTurn} nameOf={nameOf} t={t} />}

      {significator !== null && (
        <div className={css.chip} title={t(lines ? 'querent.help' : 'significator.help')}>
          <img src={plateUrl(getCard(significator.cardId))} alt="" draggable={false} />
          <span>{t(lines ? 'querent.chosen' : 'significator.chosen', { name: nameOf(significator.cardId) })}</span>
        </div>
      )}
      {next !== null && reading !== undefined && <p className={css.muted}>{whereIn(reading)(next).meaning}</p>}
      {error !== null && <p className={css.error} role="alert">{t('failed', { message: error })}</p>}
      {reading !== undefined && !finished && (
        <div className={css.actions}><Button variant="outline" size="sm" disabled={busy} onClick={() => { void end() }}>{t('end')}</Button></div>
      )}
      {finished && reading !== undefined && (
        <Completion
          reading={reading}
          canContinue={canContinue}
          repeatCard={repeatCard}
          busy={busy}
          methodLabel={methodLabel(reading.method)}
          nameOf={nameOf}
          onContinue={() => { setChosenId('thirtyfive'); setFresh(true); setQuestion('') }}
          onRepeat={() => { void repeat() }}
          onNew={() => { setFresh(true); setQuestion(''); setChosenId(methodId) }}
          t={t}
        />
      )}

      {reading !== undefined && <Turned reading={reading} where={whereIn(reading)} nameOf={nameOf} t={t} />}

      {earlier.length > 0 && (
        <details className={css.turned}>
          <summary>{t('history', { n: earlier.length })}</summary>
          {earlier.map(r => (
            <details key={r.id} className={css.past}>
              <summary>
                <span>{methodLabel(r.method)}</span>
                <span className={css.muted}>{r.question === '' ? '—' : r.question} · {t('history.cards', { n: r.drawn.length, m: r.draws })}{r.abandoned ? ` · ${t('history.ended')}` : ''}</span>
              </summary>
              <Turned reading={r} where={whereIn(r)} nameOf={nameOf} t={t} />
            </details>
          ))}
        </details>
      )}

      <details className={css.optionsBox}>
        <summary>{t('options')}</summary>
        {reading !== undefined
          ? <p className={css.muted}>{t('options.locked')}</p>
          : methodId === 'thirtyfive'
            ? <p className={css.muted}>{t('options.continue')}</p>
            : <OptionsPanel methodId={methodId} value={options} onChange={setOptions} nameOf={nameOf} t={t} />}
      </details>
    </div>
  )
}
