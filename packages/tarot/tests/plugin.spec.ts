import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry, { type Agent } from '@deepseek-ai/dsh-agent'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRegistry from '@deepseek-ai/dsh-tools'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import * as tarot from '../src/index.ts'

interface Harness {
  readonly ctx: Context
  readonly agent: Agent
  readonly followups: string[]
  readonly plugin: Awaited<ReturnType<Context['plugin']>>
}

/** The real session, projection and command registries, with only the agent's model loop stubbed. */
async function harness(config: Partial<tarot.Config> = {}): Promise<Harness> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(CommandRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRegistry)
  const plugin = await ctx.plugin(tarot, tarot.Config(config as tarot.Config))
  const session = ctx.sessions.create(SessionId(`tarot-${Math.random()}`))
  const followups: string[] = []
  const agent = {
    id: session.id, options: {}, session, status: 'idle', ctx: new Context(),
    followup: (message: { content: { type: string; text?: string }[] }) => { followups.push(message.content.map(c => c.text ?? '').join('')) },
    send: () => {}, steer: () => {}, inject: () => {}, cancel: () => {}, runMaintenance: (task: (s: AbortSignal) => unknown) => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  } as unknown as Agent
  await ctx.agents.register(agent)
  return { ctx, agent, followups, plugin }
}

async function run(test: Harness, line: string) {
  const execution = await test.ctx.commands.execute(test.agent, line, [], new AbortController().signal)
  if (execution === undefined) throw new Error('the command was not registered')
  return execution.result
}

const view = (test: Harness) => test.ctx.sessionProjections.snapshot(test.agent.session).values.tarot as tarot.TarotView

describe('plugin exports', () => {
  it('is a function plugin with named exports only', () => {
    expect(tarot.name).toBe('rws-tarot')
    expect('default' in tarot).toBe(false)
  })
})

describe('model-facing tool contract', () => {
  it('states the resolved plain-draw limit', async () => {
    const test = await harness()
    const schema = test.ctx.tools.schemas().find(item => item.name === 'tarot_lay_spread')
    expect(schema?.description).toContain('from 1 to 12')
    expect(schema?.description).not.toContain('${PLAIN_LIMIT}')
  })
})

describe('/tarot', () => {
  it('begins a reading, turns the cards one at a time and shows only the cards turned', async () => {
    const test = await harness()
    expect(await run(test, '/tarot start celtic cups-13 left upright en Will the move go well?')).toMatchObject({ kind: 'success' })
    expect(view(test).readings[0]).toMatchObject({ method: 'celtic', question: 'Will the move go well?', language: 'en', drawn: [], draws: 10 })
    expect(await run(test, '/tarot draw')).toMatchObject({ kind: 'success', text: '1 of 10 cards turned up' })
    expect(view(test).readings[0]!.drawn).toHaveLength(1)
    expect(test.followups).toHaveLength(1)
    expect(test.followups[0]).toContain('Card 1 of 10 has just been turned over')
    expect(test.followups[0]).toContain('Will the move go well?')
    for (let i = 2; i <= 10; i++) await run(test, '/tarot draw')
    expect(test.followups[9]).toContain('This is the last card')
    expect(await run(test, '/tarot draw')).toMatchObject({ kind: 'error' })
  })

  it('speaks to the model in the language the reading began in', async () => {
    const test = await harness()
    await run(test, '/tarot start celtic cups-13 left upright zh 搬家顺利吗？')
    await run(test, '/tarot draw')
    expect(test.followups[0]).toContain('你正在为提问的人占卜塔罗')
    expect(test.followups[0]).toContain('他们问：搬家顺利吗？')
  })

  it('turns cards reversed only when asked, and reads them as reversed', async () => {
    const upright = await harness()
    await run(upright, '/tarot start celtic cups-13 left upright en')
    for (let i = 0; i < 10; i++) await run(upright, '/tarot draw')
    expect(view(upright).readings[0]!.drawn.some(p => p.reversed)).toBe(false)

    const turned = await harness({ reversedShare: 1 })
    await run(turned, '/tarot start celtic cups-13 left reversed en')
    for (let i = 0; i < 10; i++) await run(turned, '/tarot draw')
    expect(view(turned).readings[0]!.drawn.every(p => p.reversed)).toBe(true)
    expect(turned.followups[0]).toMatch(/has just been turned over: .*, reversed\./)
  })

  it('refuses a second reading while one is open, a bad line, and a question over the limit', async () => {
    const test = await harness({ maxQuestion: 10 })
    expect(await run(test, '/tarot start celtic cups-13 left upright en short')).toMatchObject({ kind: 'success' })
    expect(await run(test, '/tarot start celtic cups-13 left upright en short')).toMatchObject({ kind: 'error', text: 'a reading is already in progress' })
    const fresh = await harness({ maxQuestion: 10 })
    expect(await run(fresh, '/tarot start celtic cups-13 left upright en this question is too long')).toMatchObject({ kind: 'error' })
    expect(await run(fresh, '/tarot start celtic nope left upright en')).toMatchObject({ kind: 'error' })
    expect(await run(fresh, '/tarot start celtic cups-13 up upright en')).toMatchObject({ kind: 'error' })
    expect(await run(fresh, '/tarot start celtic cups-13 left sideways en')).toMatchObject({ kind: 'error' })
    expect(await run(fresh, '/tarot draw')).toMatchObject({ kind: 'error', text: 'no reading in progress' })
    expect(view(fresh).readings).toEqual([])
  })

  it('lets the model lay a spread, which the person then turns card by card', async () => {
    const test = await harness({ defaultLanguage: 'zh' })
    const tools = test.ctx.tools
    const call = (args: Record<string, unknown>) => tools.execute({ callId: 'c1' as never, name: 'tarot_lay_spread', arguments: args, agent: test.agent, signal: new AbortController().signal } as never)
    const refused = await call({ question: 'Will I pass?' })
    expect(JSON.stringify(refused)).toContain('name the Significator')
    expect(view(test).readings).toEqual([])
    const laid = await call({ question: 'Will I pass?', sex: 'woman', age: 'under-forty', colouring: 'cups' })
    expect(JSON.stringify(laid)).toContain('The Celtic Cross is laid')
    expect(view(test).readings[0]).toMatchObject({ significator: { cardId: 'cups-11' }, question: 'Will I pass?', language: 'zh', drawn: [] })
    expect(test.followups).toEqual([])
    expect(JSON.stringify(await call({ card: 'major-16' }))).toContain('a reading is already in progress')
    await run(test, '/tarot draw')
    expect(test.followups[0]).toContain('你正在为提问的人占卜塔罗')
  })

  it('draws a plain number of cards, one at a time, with no positions', async () => {
    const test = await harness({ reversedShare: 1 })
    expect(await run(test, '/tarot start plain 2 reversed en Should I go?')).toMatchObject({ kind: 'success' })
    expect(view(test).readings[0]).toMatchObject({ method: 'plain', significator: null, facing: null, question: 'Should I go?', draws: 2, turns: [1, 1], drawn: [] })
    expect(await run(test, '/tarot draw')).toMatchObject({ kind: 'success', text: '1 of 2 cards turned up' })
    expect(test.followups[0]).toContain('Card 1 of 2 has just been turned over')
    expect(await run(test, '/tarot draw')).toMatchObject({ kind: 'success', text: '2 of 2 cards turned up' })
    expect(test.followups[1]).toContain('This is the last card.')
    expect(await run(test, '/tarot draw')).toMatchObject({ kind: 'error' })
  })

  it('ends a half-drawn reading, keeps it in the session and lets another begin', async () => {
    const test = await harness()
    expect(await run(test, '/tarot abandon')).toMatchObject({ kind: 'error' })
    await run(test, '/tarot start plain 3 upright en first')
    await run(test, '/tarot draw')
    expect(await run(test, '/tarot start plain 1 upright en again')).toMatchObject({ kind: 'error', text: 'a reading is already in progress' })
    expect(await run(test, '/tarot abandon')).toMatchObject({ kind: 'success', text: 'reading ended after 1 of 3 cards' })
    expect(await run(test, '/tarot draw')).toMatchObject({ kind: 'error' })
    expect(await run(test, '/tarot abandon')).toMatchObject({ kind: 'error' })
    expect(await run(test, '/tarot start plain 1 upright en second')).toMatchObject({ kind: 'success' })
    await run(test, '/tarot draw')
    expect(view(test).readings.map(r => [r.question, r.drawn.length, r.abandoned])).toEqual([['first', 1, true], ['second', 1, false]])
  })

  it('does not carry on an alternative reading that was ended early', async () => {
    const test = await harness()
    await run(test, '/tarot start alternative male upright en')
    await run(test, '/tarot draw')
    await run(test, '/tarot abandon')
    expect(await run(test, '/tarot continue')).toMatchObject({ kind: 'error', text: expect.stringContaining('finished') })
  })

  it('refuses a plain draw of no cards, too many, or a malformed one', async () => {
    const test = await harness()
    for (const line of ['/tarot start plain 0 upright en', '/tarot start plain 13 upright en', '/tarot start plain 2 upright', '/tarot start plain x upright en']) {
      expect(await run(test, line)).toMatchObject({ kind: 'error' })
    }
    expect(view(test).readings).toHaveLength(0)
  })

  it('lays the alternative layout and turns it a line at a time', async () => {
    const test = await harness({ reversedShare: 1 })
    expect(await run(test, '/tarot start alternative female reversed en')).toMatchObject({ kind: 'success' })
    expect(view(test).readings[0]).toMatchObject({ method: 'alternative', significator: { cardId: 'major-02', reversed: false }, facing: null, draws: 42, turns: [7, 7, 7, 7, 7, 7], drawn: [] })
    expect(await run(test, '/tarot draw')).toMatchObject({ kind: 'success', text: '7 of 42 cards turned up' })
    expect(view(test).readings[0]!.drawn).toHaveLength(7)
    expect(test.followups).toHaveLength(1)
    expect(test.followups[0]).toContain('Line 1 of 6 has just been turned over')
    expect(test.followups[0]).toContain('The High Priestess')
    for (let i = 2; i <= 6; i++) await run(test, '/tarot draw')
    expect(view(test).readings[0]!.drawn).toHaveLength(42)
    expect(test.followups[5]).toContain('This is the last line')
    expect(await run(test, '/tarot draw')).toMatchObject({ kind: 'error' })
  })

  it('carries a finished alternative reading further with the cards left over, in its language', async () => {
    const test = await harness()
    expect(await run(test, '/tarot continue')).toMatchObject({ kind: 'error' })
    await run(test, '/tarot start alternative male upright zh')
    expect(await run(test, '/tarot continue')).toMatchObject({ kind: 'error', text: 'a reading is already in progress' })
    for (let i = 0; i < 6; i++) await run(test, '/tarot draw')
    const first = view(test).readings[0]!.drawn.map(p => p.cardId)
    expect(await run(test, '/tarot continue What did I miss?')).toMatchObject({ kind: 'success' })
    const next = view(test).readings[1]!
    expect(next).toMatchObject({ method: 'thirtyfive', language: 'zh', question: 'What did I miss?', draws: 35, turns: [7, 6, 5, 4, 2, 11], significator: { cardId: 'major-01' }, drawn: [] })
    expect(await run(test, '/tarot draw')).toMatchObject({ text: '7 of 35 cards turned up' })
    await run(test, '/tarot draw')
    expect(view(test).readings[1]!.drawn).toHaveLength(13)
    expect(test.followups.at(-1)).toContain('第 2 行（共 6 行）刚刚翻开')
    for (let i = 0; i < 4; i++) await run(test, '/tarot draw')
    expect(view(test).readings[1]!.drawn).toHaveLength(35)
    expect(view(test).readings[1]!.drawn.some(p => first.includes(p.cardId))).toBe(false)
    expect(await run(test, '/tarot continue')).toMatchObject({ kind: 'error' })
  })

  it('refuses to carry a Celtic Cross further', async () => {
    const test = await harness()
    await run(test, '/tarot start celtic cups-13 left upright en')
    for (let i = 0; i < 10; i++) await run(test, '/tarot draw')
    expect(await run(test, '/tarot continue')).toMatchObject({ kind: 'error', text: expect.stringContaining('alternative') })
  })

  it('refuses a malformed alternative start', async () => {
    const test = await harness()
    expect(await run(test, '/tarot start alternative')).toMatchObject({ kind: 'error' })
    expect(await run(test, '/tarot start alternative person upright en')).toMatchObject({ kind: 'error' })
    expect(await run(test, '/tarot start alternative male sideways en')).toMatchObject({ kind: 'error' })
    expect(view(test).readings).toEqual([])
  })

  it('lets the model lay the alternative layout from the person\'s sex alone', async () => {
    const test = await harness()
    const call = (args: Record<string, unknown>) => test.ctx.tools.execute({ callId: 'c2' as never, name: 'tarot_lay_spread', arguments: args, agent: test.agent, signal: new AbortController().signal } as never)
    expect(JSON.stringify(await call({ method: 'alternative' }))).toContain('name the sex')
    const laid = await call({ method: 'alternative', sex: 'man' })
    expect(JSON.stringify(laid)).toContain('six lines of seven')
    expect(view(test).readings[0]).toMatchObject({ method: 'alternative', significator: { cardId: 'major-01' }, draws: 42 })
    expect(test.followups).toEqual([])
  })

  it('explains itself when run without arguments', async () => {
    const test = await harness()
    const result = await run(test, '/tarot')
    expect(result).toMatchObject({ kind: 'success' })
    expect(result.text).toContain('Tarot page')
  })

  it('removes the command when the plugin is disposed', async () => {
    const test = await harness()
    expect(test.ctx.commands.find(test.agent, 'tarot')).toBeDefined()
    await test.plugin.dispose()
    expect(test.ctx.commands.find(test.agent, 'tarot')).toBeUndefined()
  })
})
