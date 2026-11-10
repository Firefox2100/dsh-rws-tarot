// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { en, type TarotKey } from '../src/client/locales.ts'
import { TarotPage } from '../src/client/TarotPage.tsx'
import type { ReadingView, TarotView } from '../src/types.ts'

afterEach(() => { cleanup() })

const t = (key: TarotKey, values?: Record<string, string | number>): string => {
  let text = en[key]
  for (const [name, value] of Object.entries(values ?? {})) text = text.replace(`{${name}}`, String(value))
  return text
}

const placed = { cardId: 'major-00', reversed: false } as const
const openReading: ReadingView = {
  id: 'open', method: 'plain', question: 'Which road?', language: 'en', facing: null, significator: null,
  drawn: [placed], draws: 3, turns: [1, 1, 1], abandoned: false,
}

function page(run: (line: string) => Promise<string | null>, view?: TarotView) {
  return render(<TarotPage {...({ useProjection: () => view, run, t } as unknown as Parameters<typeof TarotPage>[0])} />)
}

describe('client page interactions', () => {
  it('configures and starts a plain draw, normalizing the question before drawing', async () => {
    const run = vi.fn(async () => null)
    page(run)
    fireEvent.click(screen.getByRole('radio', { name: /Plain draw/ }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Number of cards' }), { target: { value: '2' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Your question (optional)' }), { target: { value: '  What   now? ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Turn over card 1' }))
    await waitFor(() => {
      expect(run.mock.calls).toEqual([
        ['/tarot start plain 2 upright en What now?'],
        ['/tarot draw'],
      ])
    })
  })

  it('starts from the setup button, with the options folded to a summary', async () => {
    const run = vi.fn(async (_line: string) => null)
    page(run)
    const options = (): HTMLElement => screen.getByText(/^Options/)
    expect(options().closest('details')?.open).toBe(false)
    expect(options().textContent).toContain('Significator: Page of Wands')
    fireEvent.click(screen.getByRole('radio', { name: /Plain draw/ }))
    expect(options().textContent).not.toContain('Significator')
    fireEvent.click(screen.getByRole('radio', { name: /Celtic Cross/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Start the reading' }))
    await waitFor(() => expect(run).toHaveBeenCalledTimes(2))
    expect(run.mock.calls[0]![0]).toMatch(/^\/tarot start celtic \S+ left upright en$/)
    expect(run.mock.calls[1]![0]).toBe('/tarot draw')
  })

  it('opens a card already turned at a readable size', () => {
    page(async () => null, { maxQuestion: 500, readings: [openReading] })
    fireEvent.click(screen.getByRole('button', { name: /Click to enlarge/ }))
    expect(screen.getByAltText('The Fool')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })

  it('shows start and end failures, and clears an ended reading after success', async () => {
    const start = vi.fn(async () => 'cannot begin')
    page(start)
    fireEvent.click(screen.getByRole('button', { name: /Turn over card 1/ }))
    expect((await screen.findByRole('alert')).textContent).toContain('cannot begin')
    expect(start).toHaveBeenCalledTimes(1)

    cleanup()
    const end = vi.fn<(_: string) => Promise<string | null>>().mockResolvedValueOnce('cannot end').mockResolvedValueOnce(null)
    page(end, { maxQuestion: 500, readings: [openReading] })
    fireEvent.click(screen.getByRole('button', { name: 'End this reading' }))
    expect(screen.getByText(/1 of 3 cards have been turned/)).toBeDefined()
    expect(end).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'End reading' }))
    expect((await screen.findByRole('alert')).textContent).toContain('cannot end')
    fireEvent.click(screen.getByRole('button', { name: 'End reading' }))
    await waitFor(() => { expect(end).toHaveBeenLastCalledWith('/tarot abandon') })
  })

  it('keeps the chosen method after a reading is ended or finished', async () => {
    let view: TarotView = { maxQuestion: 500, readings: [openReading] }
    const run = vi.fn(async (line: string) => {
      if (line === '/tarot abandon') view = { maxQuestion: 500, readings: [{ ...openReading, abandoned: true }] }
      return null
    })
    const props = (): Parameters<typeof TarotPage>[0] => ({ useProjection: () => view, run, t } as unknown as Parameters<typeof TarotPage>[0])
    const { rerender } = render(<TarotPage {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: 'End this reading' }))
    fireEvent.click(screen.getByRole('button', { name: 'End reading' }))
    await waitFor(() => { expect(run).toHaveBeenCalledWith('/tarot abandon') })
    rerender(<TarotPage {...props()} />)
    await waitFor(() => { expect((screen.getByRole('radio', { name: /Plain draw/ }) as HTMLInputElement).checked).toBe(true) })

    cleanup()
    const done: ReadingView = { ...openReading, method: 'nine', draws: 9, turns: Array.from({ length: 9 }, () => 1), drawn: Array.from({ length: 9 }, () => placed) }
    page(async () => null, { maxQuestion: 500, readings: [done] })
    fireEvent.click(screen.getByRole('button', { name: 'New reading' }))
    expect((screen.getByRole('radio', { name: /Nine cards/ }) as HTMLInputElement).checked).toBe(true)
  })

  it('opens a recap card from the completion screen at a readable size', () => {
    const celtic: ReadingView = { ...openReading, method: 'celtic', facing: 'left', significator: placed, draws: 10, turns: Array.from({ length: 10 }, () => 1), drawn: Array.from({ length: 10 }, () => placed) }
    page(async () => null, { maxQuestion: 500, readings: [celtic] })
    fireEvent.click(screen.getAllByRole('button', { name: /Click to enlarge/ })[0]!)
    expect(screen.getByRole('button', { name: 'Close' })).toBeDefined()
  })

  it('repeats a finished Celtic Cross with its tenth card', async () => {
    const run = vi.fn(async () => null)
    const celtic: ReadingView = { ...openReading, method: 'celtic', facing: 'left', significator: placed, draws: 10, turns: Array.from({ length: 10 }, () => 1), drawn: Array.from({ length: 10 }, () => placed) }
    page(run, { maxQuestion: 500, readings: [celtic] })
    fireEvent.click(screen.getByRole('button', { name: 'Repeat with The Fool as the Significator' }))
    await waitFor(() => { expect(run).toHaveBeenCalledWith('/tarot repeat upright') })
  })

  it('applies the Celtic and alternative options and exposes empty card searches', () => {
    page(async () => null)
    fireEvent.click(screen.getByRole('radio', { name: 'Choose a card' }))
    const search = screen.getByPlaceholderText('Search by card name')
    fireEvent.change(search, { target: { value: 'not-a-card' } })
    expect(screen.getByText('No matching cards')).toBeDefined()
    fireEvent.change(search, { target: { value: 'fool' } })
    fireEvent.change(screen.getByRole('listbox', { name: 'Choose a card' }), { target: { value: 'major-00' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Right' }))
    fireEvent.click(screen.getByRole('radio', { name: /On \(some cards/ }))

    fireEvent.click(screen.getByRole('radio', { name: /Alternative method/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'a man' }))
    expect(screen.getByText(/Querent: The Magician/)).toBeDefined()
  })

  it('moves from a completed alternative reading into its continuation or a new reading', () => {
    const complete: ReadingView = {
      ...openReading, method: 'alternative', facing: null, significator: { cardId: 'major-01', reversed: false },
      draws: 42, turns: [7, 7, 7, 7, 7, 7], drawn: Array.from({ length: 42 }, () => placed),
    }
    page(async () => null, { maxQuestion: 500, readings: [complete] })
    fireEvent.click(screen.getByRole('button', { name: 'Continue with the 35 cards left' }))
    expect(screen.getByText('This continues the last reading with the cards it left over, so there is nothing to set.')).toBeDefined()

    cleanup()
    page(async () => null, { maxQuestion: 500, readings: [complete] })
    fireEvent.click(screen.getByRole('button', { name: 'New reading' }))
    expect(screen.getByRole('radio', { name: /Alternative method/ })).toBeDefined()
  })
})
