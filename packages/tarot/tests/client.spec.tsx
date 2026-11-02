import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { en, type TarotKey } from '../src/client/locales.ts'
import { plateUrl } from '../src/client/plates.ts'
import { TarotCall } from '../src/client/TarotCall.tsx'
import { TarotPage } from '../src/client/TarotPage.tsx'
import { getCard, getMethod } from '@dsh-rws-tarot/data'
import type { ReadingView, TarotView } from '../src/types.ts'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: ({ children }: { children: unknown }) => <button>{children as never}</button>,
}))

const t = (key: TarotKey, values?: Record<string, string | number>): string => {
  let text = en[key]
  for (const [name, value] of Object.entries(values ?? {})) text = text.replace(`{${name}}`, String(value))
  return text
}

const placed = { cardId: 'major-00', reversed: false } as const
const baseReading: ReadingView = {
  id: 'test', method: 'celtic', question: 'What now?', language: 'en', facing: 'left',
  significator: placed, drawn: [], draws: 10, turns: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], abandoned: false,
}

function render(...readings: ReadingView[]): string {
  const view: TarotView | undefined = readings.length === 0 ? undefined : { readings }
  const props = { useProjection: () => view, run: async () => null, t } as unknown as Parameters<typeof TarotPage>[0]
  return renderToStaticMarkup(<TarotPage {...props} />)
}

describe('client page', () => {
  it('builds plate URLs relative to the configured page base', () => {
    vi.stubGlobal('document', { baseURI: 'https://example.test/app/' })
    expect(plateUrl(getCard('major-00'))).toMatch(/^https:\/\/example\.test\/app\/rws-tarot\/plates\/.*\.jpg$/)
    vi.unstubAllGlobals()
  })

  it('renders a new spread with only the first card enabled', () => {
    vi.stubGlobal('document', { baseURI: 'https://example.test/' })
    const html = render()
    expect(html).toContain('Click the glowing card')
    expect(html).toContain('Turn over card 1')
    expect(html).toContain('Significator: Page of Wands')
    vi.unstubAllGlobals()
  })

  it('renders turned cards, reversed meanings and the next position', () => {
    vi.stubGlobal('document', { baseURI: 'https://example.test/' })
    const reversed = { cardId: 'cups-02', reversed: true } as const
    const html = render({ ...baseReading, drawn: [reversed] })
    expect(html).toContain(getMethod('celtic').positions[1]!.meaning)
    expect(html).toContain('No meaning is given for this card')
    expect(html).toContain('Turn over card 2')
    vi.unstubAllGlobals()
  })

  it('renders a completed reading and its new-reading action', () => {
    vi.stubGlobal('document', { baseURI: 'https://example.test/' })
    const drawn = getMethod('celtic').positions.map((_, index) => ({ cardId: `major-${String(index).padStart(2, '0')}`, reversed: false }))
    const html = render({ ...baseReading, drawn })
    expect(html).toContain('All ten cards are turned')
    expect(html).toContain('New reading')
    vi.unstubAllGlobals()
  })

  it('renders the alternative layout: six lines, the Querent card, only the first line enabled', () => {
    vi.stubGlobal('document', { baseURI: 'https://example.test/' })
    const querent = { cardId: 'major-02', reversed: false } as const
    const html = render({ ...baseReading, method: 'alternative', facing: null, significator: querent, draws: 42, turns: [7, 7, 7, 7, 7, 7], drawn: [] })
    expect(html).toContain('Click the glowing line')
    expect(html).toContain('Turn over line 1 (card 7)')
    expect(html).toContain('Line 6, card 1, face down')
    expect(html).toContain('Querent: The High Priestess')
    vi.unstubAllGlobals()
  })

  it('renders turned lines and points at the next one', () => {
    vi.stubGlobal('document', { baseURI: 'https://example.test/' })
    const drawn = Array.from({ length: 14 }, (_, i) => ({ cardId: `major-${String(i + 3).padStart(2, '0')}`, reversed: i === 0 }))
    const html = render({ ...baseReading, method: 'alternative', facing: null, significator: { cardId: 'major-01', reversed: false }, draws: 42, turns: [7, 7, 7, 7, 7, 7], drawn })
    expect(html).toContain('line 3')
    expect(html).toContain('Line 2, card 7: ')
    expect(html).toContain('Line 1, card 1: The Empress, reversed')
    expect(html).not.toContain('Turn over line 2')
    vi.unstubAllGlobals()
  })
})

describe('thirty-five card continuation', () => {
  const querent = { cardId: 'major-01', reversed: false } as const
  const done = (): ReadingView => ({ ...baseReading, method: 'alternative', facing: null, significator: querent, draws: 42, turns: [7, 7, 7, 7, 7, 7], drawn: Array.from({ length: 42 }, (_, i) => ({ cardId: i < 22 ? `major-${String(i).padStart(2, '0')}` : 'wands-01', reversed: false })) })

  it('offers the continuation only once an alternative reading is finished', () => {
    vi.stubGlobal('document', { baseURI: 'https://example.test/' })
    const html = render(done())
    expect(html).toContain('<option value="thirtyfive">')
    expect(render({ ...done(), drawn: [] })).toContain('<option value="thirtyfive" disabled="">')
    expect(render({ ...baseReading, drawn: [] })).toContain('finish a reading of the alternative method first')
    vi.unstubAllGlobals()
  })

  it('renders the lines of unequal length, read from the left, with what the next line stands for', () => {
    vi.stubGlobal('document', { baseURI: 'https://example.test/' })
    const drawn = Array.from({ length: 7 }, (_, i) => ({ cardId: `major-${String(i + 3).padStart(2, '0')}`, reversed: false }))
    const html = render({ ...baseReading, method: 'thirtyfive', facing: null, significator: querent, draws: 35, turns: [7, 6, 5, 4, 2, 11], drawn })
    expect(html).toContain('repeat(11, minmax(0, 1fr))')
    expect(html).toContain('style="grid-column:1;grid-row:1"')
    expect(html).toContain('Turn over line 2 (card 1)')
    expect(html).toContain('Line 6, card 11, face down')
    expect(html).toContain('Click the glowing line to turn it over: line 2')
    expect(html).toContain('The Second Line stands for the person or subject of the divination.')
    expect(html).toContain('Querent: The Magician')
    vi.unstubAllGlobals()
  })

  it('renders a plain draw as a row of cards with no positions, the next one glowing', () => {
    vi.stubGlobal('document', { baseURI: 'https://example.test/' })
    const drawn = [{ cardId: 'major-03', reversed: false }]
    const html = render({ ...baseReading, method: 'plain', facing: null, significator: null, draws: 4, turns: [1, 1, 1, 1], drawn })
    expect(html).toContain('repeat(4, minmax(0, 1fr))')
    expect(html).toContain('Turn over card 2')
    expect(html).toContain('Card 4, face down')
    expect(html).toContain('Click the glowing card to turn it over: card 2')
    expect(html).not.toContain('Significator:')
    vi.unstubAllGlobals()
  })

  it('offers to end a reading that is open, and not one that is finished', () => {
    vi.stubGlobal('document', { baseURI: 'https://example.test/' })
    const open: ReadingView = { ...baseReading, method: 'plain', significator: null, facing: null, draws: 3, turns: [1, 1, 1], drawn: [placed] }
    expect(render(open)).toContain('End this reading')
    expect(render({ ...open, drawn: [placed, placed, placed] })).not.toContain('End this reading')
    vi.unstubAllGlobals()
  })

  it('shows an ended reading as a new start, with the earlier readings listed and openable', () => {
    vi.stubGlobal('document', { baseURI: 'https://example.test/' })
    const ended: ReadingView = { ...baseReading, method: 'plain', significator: null, facing: null, question: 'Which road?', draws: 3, turns: [1, 1, 1], drawn: [placed], abandoned: true }
    const html = render(ended)
    expect(html).toContain('Earlier readings (1)')
    expect(html).toContain('Which road?')
    expect(html).toContain('1 of 3 cards turned')
    expect(html).toContain('ended early')
    expect(html).toContain('Click the glowing card to turn it over and begin the reading.')
    expect(html).not.toContain('End this reading')
    expect(render({ ...ended, abandoned: false })).not.toContain('Earlier readings')
    vi.unstubAllGlobals()
  })
})

describe('the model\'s tarot call row', () => {
  const call = (block: object, phase = 'started') => renderToStaticMarkup(<TarotCall {...({ phase, block, t } as unknown as Parameters<typeof TarotCall>[0])} />)

  it('says what was laid, from the call alone', () => {
    expect(call({ callId: 'c', argsRaw: '{"method":"plain","count":3}' })).toContain('Laying the cards')
    const settled = (argsRaw: string, extra = {}) => ({ kind: 'settled', callId: 'c', call: { argsRaw }, content: [{ type: 'text', text: 'ok' }], isError: false, ...extra })
    expect(call(settled('{"method":"plain","count":3}'))).toContain('Laid: Plain draw · 3 cards')
    expect(call(settled('{"card":"cups-13"}'))).toContain('Laid: Celtic Cross')
    expect(call(settled('{"method":"thir'))).toContain('Laid: ')
  })

  it('shows why a call failed, in one line', () => {
    const html = call({ kind: 'settled', callId: 'c', call: { argsRaw: '{}' }, content: [{ type: 'text', text: 'a reading is already in progress\nmore' }], isError: true })
    expect(html).toContain('a reading is already in progress')
    expect(html).not.toContain('more')
    expect(html).toContain('data-state="error"')
  })
})
