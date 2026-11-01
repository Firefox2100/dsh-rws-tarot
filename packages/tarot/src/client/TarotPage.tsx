import { useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { cardName, cards, getCard, getMethod, positionMeaning, positionName, type MethodPosition, type Suit } from '@dsh-rws-tarot/data'
import { significatorFor, type Person, type Placed } from '@dsh-rws-tarot/engine'
import type { ReadingView } from '../types.ts'
import { plateUrl } from './plates.ts'
import type { TarotInjected } from './index.ts'
import css from './TarotPage.module.css'

type Props = PropsRuntime<'sidebar.right.pane.tab'> & InjectFace<TarotInjected> & PropsLocale<'tarot'>
type T = Props['t']
/** A card's name in the language of the screen. */
type NameOf = (cardId: string) => string

const SUITS: readonly Suit[] = ['wands', 'cups', 'swords', 'pentacles']
const MAX_QUESTION = 500

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

function Turned({ reading, positions, nameOf, t }: { reading: ReadingView; positions: readonly MethodPosition[]; nameOf: NameOf; t: T }) {
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
                  <span>{positions[i]!.name}</span>
                  <span className={css.muted}>{nameOf(card.id)} · {t(placed.reversed ? 'reversed' : 'upright')}</span>
                </summary>
                <p className={css.quote}><em>{t('position.meaning')}:</em> {positions[i]!.meaning}</p>
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

interface Options {
  mode: 'person' | 'card'
  person: Person
  suit: Suit
  picked: string
  facing: 'left' | 'right'
  reversals: boolean
}

const initialOptions: Options = { mode: 'person', person: { sex: 'female', fortyOrOver: false }, suit: 'wands', picked: 'major-00', facing: 'left', reversals: false }

function OptionsPanel({ value, onChange, nameOf, t }: { value: Options; onChange: (next: Options) => void; nameOf: NameOf; t: T }) {
  const method = getMethod('celtic')
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
      <section>
        <h4>{t('significator.title')}</h4>
        <p className={css.muted}>{t('significator.help')}</p>
        <div className={css.row}>
          {radio('mode', value.mode === 'person', () => { set({ mode: 'person' }) }, t('significator.person'))}
          {radio('mode', value.mode === 'card', () => { set({ mode: 'card' }) }, t('significator.card'))}
        </div>
        {value.mode === 'person' ? (
          <>
            <div className={css.row}>
              <span>{t('significator.sex')}</span>
              {radio('sex', value.person.sex === 'male', () => { set({ person: { ...value.person, sex: 'male' } }) }, t('significator.male'))}
              {radio('sex', value.person.sex === 'female', () => { set({ person: { ...value.person, sex: 'female' } }) }, t('significator.female'))}
            </div>
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
                    <input type="radio" name="suit" checked={value.suit === s} onChange={() => { set({ suit: s }) }} />
                    <span><strong>{t(`suit.${s}`)}</strong> <span className={css.muted}>{rule.text}</span></span>
                  </label>
                )
              })}
              <p className={css.muted}>{method.significator.reserve.text}</p>
            </div>
          </>
        ) : (
          <select value={value.picked} onChange={(e) => { set({ picked: e.target.value }) }} aria-label={t('significator.pick')}>
            <optgroup label={t('arcana.major')}>{cards.filter(c => c.arcana === 'major').map(c => <option key={c.id} value={c.id}>{nameOf(c.id)}</option>)}</optgroup>
            {SUITS.map(s => <optgroup key={s} label={t(`suit.${s}`)}>{cards.filter(c => c.suit === s).map(c => <option key={c.id} value={c.id}>{nameOf(c.id)}</option>)}</optgroup>)}
          </select>
        )}
        <div className={css.row}>
          <span>{t('significator.facing')}</span>
          {radio('facing', value.facing === 'left', () => { set({ facing: 'left' }) }, t('significator.left'))}
          {radio('facing', value.facing === 'right', () => { set({ facing: 'right' }) }, t('significator.right'))}
        </div>
        <p className={css.muted}>{t('significator.facingHelp')} {method.facing.text}</p>
      </section>
      <section>
        <h4>{t('reversed.title')}</h4>
        {radio('rev', !value.reversals, () => { set({ reversals: false }) }, t('reversed.off'))}
        {radio('rev', value.reversals, () => { set({ reversals: true }) }, t('reversed.on'))}
      </section>
    </div>
  )
}

/**
 * The tarot page of the right dock: pick how to draw, then click the glowing card and it turns over and is read in the
 * conversation. Every card shown comes from the reading the host keeps in the session, so a reload shows the same table.
 */
export function TarotPage({ useProjection, run, t }: Props) {
  const view = useProjection('tarot')
  const [methodId, setMethodId] = useState('celtic')
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<Options>(initialOptions)
  const [fresh, setFresh] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const language = t('language')
  const nameOf: NameOf = cardId => cardName(getCard(cardId), language)
  const book = getMethod(methodId)
  const method = { ...book, positions: book.positions.map(p => ({ ...p, name: positionName(book.id, p, language), meaning: positionMeaning(book.id, p, language) })) }
  const last = view?.readings.at(-1)
  const finished = last !== undefined && last.drawn.length >= last.draws
  const reading = last !== undefined && !(fresh && finished) ? last : undefined
  const drawn = reading?.drawn ?? []
  const next = drawn.length < method.positions.length ? drawn.length : null
  const facing = reading?.facing ?? options.facing
  const significator: Placed | null = reading !== undefined
    ? reading.significator
    : { cardId: options.mode === 'person' ? significatorFor(options.person, options.suit) : options.picked, reversed: false }

  const turn = async (): Promise<void> => {
    if (next === null) return
    setBusy(true)
    setError(null)
    try {
      if (reading === undefined) {
        const asked = question.replace(/\s+/g, ' ').trim().slice(0, MAX_QUESTION)
        const failure = await run(`/tarot start ${methodId} ${significator!.cardId} ${options.facing} ${options.reversals ? 'reversed' : 'upright'} ${language} ${asked}`.trim())
        if (failure !== null) { setError(failure); return }
        setFresh(false)
      }
      const failure = await run('/tarot draw')
      if (failure !== null) setError(failure)
    } finally { setBusy(false) }
  }

  return (
    <div className={css.page}>
      <div className={css.top}>
        <label className={css.field}>
          <span>{t('how.label')}</span>
          <select value={methodId} onChange={(e) => { setMethodId(e.target.value) }} disabled={reading !== undefined && !finished}>
            <option value="celtic">{t('method.celtic')} — {t('method.celtic.detail')}</option>
            {(['method.alt42', 'method.alt35', 'method.plain'] as const).map(key => <option key={key} value={key} disabled>{t(key)} ({t('method.soon')})</option>)}
          </select>
        </label>
        <label className={css.field}>
          <span>{t('question.label')}</span>
          {reading === undefined
            ? <input type="text" value={question} maxLength={MAX_QUESTION} placeholder={t('question.placeholder')} onChange={(e) => { setQuestion(e.target.value) }} />
            : <p className={css.asked}>{reading.question === '' ? '—' : reading.question}</p>}
        </label>
      </div>

      <Board positions={method.positions} facing={facing} significator={significator} drawn={drawn} next={next} busy={busy} onTurn={() => { void turn() }} nameOf={nameOf} t={t} />

      {significator !== null && (
        <div className={css.chip} title={t('significator.help')}>
          <img src={plateUrl(getCard(significator.cardId))} alt="" draggable={false} />
          <span>{t('significator.chosen', { name: nameOf(significator.cardId) })}</span>
        </div>
      )}
      <p className={css.hint} role="status">
        {next === null
          ? t('hint.done')
          : reading === undefined ? t('hint.begin') : t('hint.next', { position: method.positions[next]!.name })}
      </p>
      {next !== null && reading !== undefined && <p className={css.muted}>{method.positions[next]!.meaning}</p>}
      {error !== null && <p className={css.error} role="alert">{t('failed', { message: error })}</p>}
      {finished && <div className={css.actions}><Button variant="outline" size="sm" onClick={() => { setFresh(true); setQuestion('') }}>{t('newReading')}</Button></div>}

      {reading !== undefined && <Turned reading={reading} positions={method.positions} nameOf={nameOf} t={t} />}

      <details className={css.optionsBox}>
        <summary>{t('options')}</summary>
        {reading === undefined ? <OptionsPanel value={options} onChange={setOptions} nameOf={nameOf} t={t} /> : <p className={css.muted}>{t('options.locked')}</p>}
      </details>
    </div>
  )
}
