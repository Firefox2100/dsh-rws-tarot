import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply } from '../src/client/index.ts'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: ({ children }: { children: unknown }) => children,
}))

describe('client plugin', () => {
  it('registers its dictionaries, tab, page and tool row, and adapts command results', async () => {
    const effects: (() => unknown)[] = []
    const registrations: { key: string; inject?: (sessionId: string) => { run: (line: string) => Promise<string | null> } }[] = []
    const execute = vi.fn()
    const ctx = {
      locale: { bind: () => (key: string) => key, register: vi.fn() },
      sidebarRightTabs: { register: vi.fn() },
      slots: {
        inject: (_name: string, factory: () => unknown) => factory(),
        register: (registration: typeof registrations[number]) => { registrations.push(registration) },
      },
      remote: { commands: { execute } },
      effect: (effect: () => unknown) => { effects.push(effect); return effect() },
    } as unknown as Context

    apply(ctx)
    expect(effects).toHaveLength(4)
    expect(ctx.locale.register).toHaveBeenCalledWith('tarot', expect.objectContaining({ zh: expect.any(Object), en: expect.any(Object) }))
    expect(ctx.sidebarRightTabs.register).toHaveBeenCalledWith(expect.objectContaining({ id: 'dsh-rws-tarot', kind: 'tarot' }))
    expect(registrations.map(item => item.key)).toEqual(['dsh-rws-tarot', 'tarot_lay_spread'])

    const run = registrations[0]!.inject!('session').run
    execute.mockResolvedValueOnce({ ok: false, error: { message: 'offline', code: 'unavailable' } })
    await expect(run('/tarot draw')).resolves.toBe('offline (unavailable)')
    execute.mockResolvedValueOnce({ ok: true, value: undefined })
    await expect(run('/tarot missing')).resolves.toBe('unknown command: /tarot missing')
    execute.mockResolvedValueOnce({ ok: true, value: { result: { kind: 'error', text: 'not ready' } } })
    await expect(run('/tarot draw')).resolves.toBe('not ready')
    execute.mockResolvedValueOnce({ ok: true, value: { result: { kind: 'success', text: 'done' } } })
    await expect(run('/tarot draw')).resolves.toBeNull()
  })
})
