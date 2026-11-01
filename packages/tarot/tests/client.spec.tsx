import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { en, type TarotKey } from '../src/client/locales.ts'
import { plateUrl } from '../src/client/plates.ts'
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
  significator: placed, drawn: [], draws: 10,
}

function render(reading?: ReadingView): string {
  const view: TarotView | undefined = reading === undefined ? undefined : { readings: [reading] }
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
})
