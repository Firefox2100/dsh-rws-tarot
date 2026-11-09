import { useState, type CSSProperties } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { cardName, cards, colouringText, facingText, getCard, getMethod, meaningText, positionMeaning, positionName, querentText, reserveText, type MethodPosition, type Suit } from '@dsh-rws-tarot/data'
import { LAYOUT_SIZES, PLAIN_LIMIT, significatorFor, type Person, type Placed } from '@dsh-rws-tarot/engine'
import type { ReadingView } from '../types.ts'
import { Button } from './Button.tsx'
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

/** One mark of a spread's miniature: a card, or a line of a lines layout, as a rectangle of the diagram. */
interface Shape { x: number; y: number; w?: number; h?: number }

const CARD_SHAPE = { w: 10, h: 19 } as const

/** The miniature each spread tile draws, as percentages of the diagram's box. */
const DIAGRAMS: Readonly<Record<MethodId, readonly Shape[]>> = {
  celtic: [
    { x: 45, y: 40 }, { x: 45, y: 10 }, { x: 45, y: 70 }, { x: 25, y: 40 }, { x: 65, y: 40 },
    { x: 30, y: 45, w: 25, h: 10 },
    { x: 80, y: 8 }, { x: 80, y: 30 }, { x: 80, y: 52 }, { x: 80, y: 74 },
  ],
  alternative: [5, 20, 35, 50, 65, 80].map(y => ({ x: 15, y, w: 70, h: 6 })),
  thirtyfive: [70, 60, 50, 40, 20, 55].map((w, i) => ({ x: 15, y: 5 + i * 15, w, h: 6 })),
  plain: [8, 31, 54, 77].map(x => ({ x, y: 40 })),
  three: [15, 45, 75].map(x => ({ x, y: 40 })),
  nine: [15, 45, 75].flatMap(x => [12, 40, 68].map(y => ({ x, y }))),
}

const SPREADS = [
  { id: 'celtic', name: 'method.celtic', detail: 'method.celtic.detail' },
  { id: 'alternative', name: 'method.alt42', detail: 'method.alt42.detail' },
  { id: 'thirtyfive', name: 'method.alt35', detail: 'method.alt35.detail' },
  { id: 'plain', name: 'method.plain', detail: 'method.plain.detail' },
  { id: 'three', name: 'method.three', detail: 'method.three.detail' },
  { id: 'nine', name: 'method.nine', detail: 'method.nine.detail' },
] as const

/** The miniature a spread tile carries: the layout at a glance, drawn from its own shapes. */
function Diagram({ method }: { method: MethodId }) {
  return (
    <span className={css.diagram} aria-hidden="true">
      {DIAGRAMS[method].map((shape, index) => (
        <i key={index} style={{ left: `${shape.x}%`, top: `${shape.y}%`, width: `${shape.w ?? CARD_SHAPE.w}%`, height: `${shape.h ?? CARD_SHAPE.h}%` }} />
      ))}
    </span>
  )
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
  /** Open the enlarged view of a card already turned. */
  onPeek: (index: number) => void
  nameOf: NameOf
  t: T
}

/** The spread as it lies: the Significator face up, every other card face down until it is turned over. */
function Board({ positions, facing, significator, drawn, next, busy, onTurn, onPeek, nameOf, t }: BoardProps) {
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
              style={{ '--i': index } as CSSProperties}
              disabled={placed === undefined && (!isNext || busy)}
              aria-label={placed === undefined ? label : `${label}. ${t('peek')}`}
              title={placed === undefined ? position.name : `${position.name} · ${t('peek')}`}
              onClick={() => { if (placed === undefined) onTurn(); else onPeek(index) }}
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
      {rows.map((count, row) => {
        const line = row + 1
        const isNext = row === nextLine
        return (
          <button
            key={line}
            type="button"
            className={cx(css.line, isNext && css.lineNext)}
            style={{ gridColumn: `1 / span ${width}`, gridRow: line }}
            disabled={!isNext || busy}
            aria-label={t(isNext ? 'line.turn' : 'line.back', { line, n: rightToLeft ? count : 1 })}
            onClick={onTurn}
          >
            <span className={css.lineCards} style={{ gridTemplateColumns: `repeat(${width}, minmax(44px, 1fr))` }}>
              {Array.from({ length: count }, (_, k) => {
                const index = starts[row]! + k
                const n = k + 1
                const placed = drawn[index]
                const where = { line, n }
                const label = placed === undefined
                  ? t('line.back', where)
                  : `${t('line.label', where)}: ${nameOf(placed.cardId)}, ${t(placed.reversed ? 'reversed' : 'upright')}`
                return (
                  <span key={index} className={css.slot} style={{ gridColumn: rightToLeft ? width + 1 - n : n }} title={t('line.label', where)}>
                    <span className={cx(css.card, placed !== undefined && css.flipped)} style={{ '--i': k } as CSSProperties}>
                      <span className={css.inner}>
                        <span className={css.back}><span className={css.number}>{n}</span></span>
                        <span className={css.front}>
                          {placed !== undefined && <Face placed={placed} label={label} />}
                        </span>
                      </span>
                    </span>
                  </span>
                )
              })}
            </span>
          </button>
        )
      })}
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
  /** Open the enlarged view of a card already turned. */
  onPeek: (index: number) => void
  nameOf: NameOf
  t: T
}

/** A draw without the book's positions as it lies (a plain draw, three cards or nine): cards in rows, turned one at a time from the first. */
function PlainBoard({ count, columns, slotName, captioned, drawn, next, busy, onTurn, onPeek, nameOf, t }: PlainBoardProps) {
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
              style={{ '--i': index } as CSSProperties}
              disabled={placed === undefined && (!isNext || busy)}
              aria-label={placed === undefined ? label : `${label}. ${t('peek')}`}
              title={placed === undefined ? slotName(index) : `${slotName(index)} · ${t('peek')}`}
              onClick={() => { if (placed === undefined) onTurn(); else onPeek(index) }}
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
  const language = t('language')
  return (
    <details className={css.turned}>
      <summary>{t('cards')}</summary>
      <ol className={css.list}>
        {reading.drawn.map((placed, i) => {
          const card = getCard(placed.cardId)
          const scenario = placed.reversed ? 'reversed' : 'upright'
          const entries = card.meanings.map((meaning, index) => ({ meaning, index })).filter(({ meaning }) => meaning.scenario === scenario)
          const divinatory = entries.filter(({ meaning }) => meaning.context === 'divinatory')
          const additional = entries.filter(({ meaning }) => meaning.context === 'additional')
          return (
            <li key={i}>
              <details>
                <summary>
                  <span className={css.summaryNumber}>{i + 1}</span>
                  <span>{where(i).name}</span>
                  <span className={css.muted}>{nameOf(card.id)} · {t(placed.reversed ? 'reversed' : 'upright')}</span>
                </summary>
                {where(i).meaning !== null && <p className={css.quote}><em>{t('position.meaning')}:</em> {where(i).meaning}</p>}
                {divinatory.map(({ index }) => <p key={`d${index}`}><strong>{t('card.meaning')}.</strong> {meaningText(card, index, language)}</p>)}
                {divinatory.length === 0 && <p className={css.muted}>{t('card.none')}</p>}
                {additional.map(({ index }) => <p key={`a${index}`}><strong>{t('card.also')}.</strong> {meaningText(card, index, language)}</p>)}
              </details>
            </li>
          )
        })}
      </ol>
    </details>
  )
}

function EarlierReading({ reading, methodLabel, where, nameOf, t }: { reading: ReadingView; methodLabel: string; where: (index: number) => { name: string; meaning: string | null }; nameOf: NameOf; t: T }) {
  const [open, setOpen] = useState(false)
  return (
    <details className={css.past} onToggle={(event) => { setOpen(event.currentTarget.open) }}>
      <summary>
        <span>{methodLabel}</span>
        <span className={css.muted}>{reading.question === '' ? '—' : reading.question} · {t('history.cards', { n: reading.drawn.length, m: reading.draws })}{reading.abandoned ? ` · ${t('history.ended')}` : ''}</span>
      </summary>
      {open && <Turned reading={reading} where={where} nameOf={nameOf} t={t} />}
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

function OptionsPanel({ methodId, value, onChange, nameOf, language, t }: { methodId: Chosen; value: Options; onChange: (next: Options) => void; nameOf: NameOf; language: string; t: T }) {
  const [cardSearch, setCardSearch] = useState('')
  const method = getMethod('celtic')
  const lines = methodId === 'alternative'
  const normalizedSearch = cardSearch.trim().toLocaleLowerCase()
  const matchingCards = cards.filter(card => normalizedSearch === '' || card.id.includes(normalizedSearch) || nameOf(card.id).toLocaleLowerCase().includes(normalizedSearch))
  const sex = (name: string) => (
    <fieldset className={css.group}>
      <legend>{t('significator.sex')}</legend>
      <div className={css.row}>
        {radio(name, value.person.sex === 'male', () => { set({ person: { ...value.person, sex: 'male' } }) }, t('significator.male'))}
        {radio(name, value.person.sex === 'female', () => { set({ person: { ...value.person, sex: 'female' } }) }, t('significator.female'))}
      </div>
    </fieldset>
  )
  const set = (patch: Partial<Options>): void => { onChange({ ...value, ...patch }) }
  const radio = (name: string, on: boolean, change: () => void, label: string) => (
    <label className={css.choice}><input type="radio" name={name} checked={on} onChange={change} />{label}</label>
  )
  return (
    <div className={css.options}>
      {methodId === 'plain' || methodId === 'three' || methodId === 'nine' ? null : lines ? (
        <section>
          <h4>{t('querent.title')}</h4>
          <p className={css.muted}>{t('querent.help')}</p>
          {sex('querentSex')}
          <p className={css.muted}>{querentText(getMethod('alternative'), language)}</p>
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
            <fieldset className={css.group}>
              <legend>{t('significator.age')}</legend>
              <div className={css.row}>
                {radio('age', !value.person.fortyOrOver, () => { set({ person: { ...value.person, fortyOrOver: false } }) }, t('significator.under40'))}
                {radio('age', value.person.fortyOrOver, () => { set({ person: { ...value.person, fortyOrOver: true } }) }, t('significator.over40'))}
              </div>
            </fieldset>
            <fieldset className={css.colouring}>
              <legend>{t('significator.colouring')}</legend>
              {SUITS.map((s) => (
                <label key={s} className={css.choice}>
                  <input type="radio" name="suit" aria-label={t(`suit.${s}`)} checked={value.suit === s} onChange={() => { set({ suit: s }) }} />
                  <span><strong>{t(`suit.${s}`)}</strong> <span className={css.muted}>{colouringText(method, s, language)}</span></span>
                </label>
              ))}
              <p className={css.muted}>{reserveText(method, language)}</p>
            </fieldset>
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
        <fieldset className={css.group}>
          <legend>{t('significator.facing')}</legend>
          <div className={css.row}>
            {radio('facing', value.facing === 'left', () => { set({ facing: 'left' }) }, t('significator.left'))}
            {radio('facing', value.facing === 'right', () => { set({ facing: 'right' }) }, t('significator.right'))}
          </div>
        </fieldset>
        <p className={css.muted}>{t('significator.facingHelp')} {facingText(method, language)}</p>
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

function Completion({ reading, canContinue, repeatCard, methodLabel, nameOf, onContinue, onRepeat, onNew, onPeek, busy, t }: { reading: ReadingView; canContinue: boolean; repeatCard: string | null; methodLabel: string; nameOf: NameOf; onContinue: () => void; onRepeat: () => void; onNew: () => void; onPeek: (index: number) => void; busy: boolean; t: T }) {
  return (
    <section className={css.completion}>
      <div>
        <h3>{t('complete.title')}</h3>
        <p>{methodLabel}{reading.question === '' ? '' : ` · ${reading.question}`}</p>
      </div>
      <div className={css.recap} aria-label={t('complete.cards')}>
        {reading.drawn.map((placed, index) => (
          <figure key={index}>
            <button type="button" className={css.recapCard} aria-label={`${nameOf(placed.cardId)} · ${t('peek')}`} onClick={() => { onPeek(index) }}>
              <img className={placed.reversed ? css.upside : undefined} src={plateUrl(getCard(placed.cardId))} alt={nameOf(placed.cardId)} draggable={false} />
            </button>
            <figcaption>{nameOf(placed.cardId)}</figcaption>
          </figure>
        ))}
      </div>
      <p className={css.muted}>{t('complete.help')}</p>
      {repeatCard !== null && <p className={css.muted}>{t('complete.repeatHelp')}</p>}
      <div className={css.actions}>
        {canContinue && <Button variant="primary" onClick={onContinue}>{t('complete.continue')}</Button>}
        {repeatCard !== null && <Button variant="primary" disabled={busy} onClick={onRepeat}>{t('complete.repeat', { name: nameOf(repeatCard) })}</Button>}
        <Button variant={canContinue || repeatCard !== null ? 'outline' : 'primary'} onClick={onNew}>{t('newReading')}</Button>
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
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [peek, setPeek] = useState<number | null>(null)

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
    setPeek(null)
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
    setPeek(null)
    try {
      const failure = await run('/tarot abandon')
      if (failure !== null) setError(failure)
      else { setQuestion(''); setChosenId(methodId); setConfirmEnd(false) }
    } finally { setBusy(false) }
  }
  const repeat = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setPeek(null)
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
  const turnedCount = lines ? (next === null ? rows.length : nextRow) : drawn.length
  const turnTotal = lines ? rows.length : total
  const ratio = turnTotal === 0 ? 0 : Math.min(1, turnedCount / turnTotal)
  const instruction = busy
    ? t('hint.busy')
    : next === null
      ? t(lines || free ? 'hint.doneLines' : 'hint.done')
      : reading === undefined
        ? t(free ? 'hint.begin' : lines ? 'hint.beginLines' : 'hint.begin')
        : free ? t('hint.nextPlain', { n: next + 1 }) : lines ? t('hint.nextLine', { line: nextRow + 1 }) : t('hint.next', { position: positions[next]!.name })
  const onTurn = (): void => { void turn() }
  /** Show a card already turned at a readable size; clicking it again folds the view away. */
  const peekAt = (index: number): void => { setPeek(current => current === index ? null : index) }
  const askedLine = reading !== undefined && reading.question !== '' ? ` · ${reading.question}` : ''
  const statusLabel = `${methodLabel(methodId)}${askedLine}`

  return (
    <div className={css.page} aria-busy={busy}>
      {reading === undefined && (
        <div className={css.setup}>
          <div className={css.top}>
            <fieldset className={css.spreads}>
              <legend>{t('how.label')}</legend>
              {SPREADS.map((spread) => {
                const unavailable = spread.id === 'thirtyfive' && !canContinue
                return (
                  <label key={spread.id} className={cx(css.spreadTile, methodId === spread.id && css.spreadTileOn, unavailable && css.spreadTileOff)}>
                    <input
                      type="radio"
                      name="spread"
                      className={css.srOnly}
                      checked={methodId === spread.id}
                      disabled={unavailable}
                      onChange={() => { setChosenId(spread.id); setFresh(true) }}
                    />
                    <Diagram method={spread.id} />
                    <span className={css.spreadText}>
                      <span className={css.spreadName}>{t(spread.name)}</span>
                      <span className={css.spreadDetail}>{unavailable ? t('method.needsAlt') : t(spread.detail)}</span>
                    </span>
                  </label>
                )
              })}
            </fieldset>
            {plain && (
              <label className={css.field}>
                <span>{t('plain.count')}</span>
                <select value={options.count} onChange={(e) => { setOptions({ ...options, count: Number(e.target.value) }) }}>
                  {COUNTS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            )}
            <label className={css.field}>
              <span>{t('question.label')}</span>
              <textarea rows={2} value={question} maxLength={maxQuestion} placeholder={t(methodId === 'thirtyfive' ? 'question.placeholderContinue' : lines ? 'question.placeholderLines' : 'question.placeholder')} onChange={(e) => { setQuestion(e.target.value) }} />
              {maxQuestion - question.length <= 50 && <span className={css.counter}>{question.length} / {maxQuestion}</span>}
            </label>
          </div>

          <details className={css.optionsBox} key={methodId}>
            <summary>{t('options')}{significator === null ? '' : ` · ${t(lines ? 'querent.chosen' : 'significator.chosen', { name: nameOf(significator.cardId) })}`}</summary>
            {methodId === 'thirtyfive'
              ? <p className={css.muted}>{t('options.continue')}</p>
              : <OptionsPanel methodId={methodId} value={options} onChange={setOptions} nameOf={nameOf} language={language} t={t} />}
          </details>

          <div className={css.actions}>
            <Button variant="primary" size="md" disabled={busy} onClick={onTurn}>{t('start')}</Button>
          </div>
        </div>
      )}

      <div className={css.progress} role="status" aria-live="polite">
        <span className={css.progressTitle} title={statusLabel}>{statusLabel}</span>
        <span className={css.progressCount}>{progress}</span>
        <span>{instruction}</span>
        <span className={css.progressTrack} aria-hidden="true"><span className={css.progressFill} style={{ width: `${Math.round(ratio * 100)}%` }} /></span>
      </div>

      {peek !== null && reading !== undefined && reading.drawn[peek] !== undefined && (
        <div className={css.peek}>
          <img
            className={cx(css.peekCard, reading.drawn[peek]!.reversed && css.upside)}
            src={plateUrl(getCard(reading.drawn[peek]!.cardId))}
            alt={nameOf(reading.drawn[peek]!.cardId)}
            draggable={false}
          />
          <div className={css.peekText}>
            <strong>{nameOf(reading.drawn[peek]!.cardId)}</strong>
            <span className={css.muted}>{whereIn(reading)(peek).name} · {t(reading.drawn[peek]!.reversed ? 'reversed' : 'upright')}</span>
            <Button variant="outline" onClick={() => { setPeek(null) }}>{t('close')}</Button>
          </div>
        </div>
      )}

      {(reading === undefined || !finished) && (free
        ? <PlainBoard count={count} columns={plain ? Math.min(count, 6) : 3} slotName={methodId === 'three' ? i => threePlaces[i]!.name : methodId === 'nine' ? nineCell : n => t('plain.card', { n: n + 1 })} captioned={!plain} drawn={drawn} next={next} busy={busy} onTurn={onTurn} onPeek={peekAt} nameOf={nameOf} t={t} />
        : lines
        ? <LinesBoard rows={rows} rightToLeft={(methodId === 'alternative' ? alternative : continuation).direction === 'right-to-left'} querent={methodId === 'alternative' ? significator : null} drawn={drawn} next={next} busy={busy} onTurn={onTurn} nameOf={nameOf} t={t} />
        : <Board positions={positions} facing={facing} significator={significator} drawn={drawn} next={next} busy={busy} onTurn={onTurn} onPeek={peekAt} nameOf={nameOf} t={t} />)}

      {reading === undefined && <MethodGuide methodId={methodId} positions={positions} linePositions={linePositions} threePositions={threePlaces} t={t} />}

      {reading !== undefined && significator !== null && (
        <div className={css.chip} title={t(lines ? 'querent.help' : 'significator.help')}>
          <img src={plateUrl(getCard(significator.cardId))} alt="" draggable={false} />
          <span>{t(lines ? 'querent.chosen' : 'significator.chosen', { name: nameOf(significator.cardId) })}</span>
        </div>
      )}
      {next !== null && reading !== undefined && <p className={css.muted}>{whereIn(reading)(next).meaning}</p>}
      {error !== null && <p className={css.error} role="alert">{t('failed', { message: error })}</p>}
      {reading !== undefined && !finished && (
        confirmEnd
          ? <div className={css.endConfirm}>
              <p>{t('end.confirm', { n: reading.drawn.length, m: reading.draws })}</p>
              <div className={css.actions}>
                <Button variant="outline" disabled={busy} onClick={() => { setConfirmEnd(false) }}>{t('end.cancel')}</Button>
                <Button variant="outline" className={css.dangerAction} disabled={busy} onClick={() => { void end() }}>{t('end.confirmAction')}</Button>
              </div>
            </div>
          : <div className={css.actions}><Button variant="outline" disabled={busy} onClick={() => { setConfirmEnd(true) }}>{t('end')}</Button></div>
      )}
      {finished && reading !== undefined && (
        <Completion
          reading={reading}
          canContinue={canContinue}
          repeatCard={repeatCard}
          busy={busy}
          methodLabel={methodLabel(reading.method)}
          nameOf={nameOf}
          onPeek={peekAt}
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
            <EarlierReading key={r.id} reading={r} methodLabel={methodLabel(r.method)} where={whereIn(r)} nameOf={nameOf} t={t} />
          ))}
        </details>
      )}
    </div>
  )
}
