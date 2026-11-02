import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import AgentRegistry, { type Agent } from '@deepseek-ai/dsh-agent'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRegistry from '@deepseek-ai/dsh-tools'
import * as tarot from '../src/index.ts'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

/** Boot a cordis.yml carrying the plugin's block the way the host's profile does: by name, through the real Loader. */
async function boot(configLines: readonly string[]): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-rws-tarot-loader-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-session'",
    "- name: '@deepseek-ai/dsh-session-projection'",
    "- name: '@deepseek-ai/dsh-commands'",
    "- name: '@deepseek-ai/dsh-agent'",
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-tools'",
    '- name: dsh-rws-tarot',
    ...configLines.length > 0 ? ['  config:', ...configLines] : [],
    '',
  ].join('\n'))

  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-session', SessionStore],
    ['@deepseek-ai/dsh-session-projection', SessionProjectionRegistry],
    ['@deepseek-ai/dsh-commands', CommandRuntime],
    ['@deepseek-ai/dsh-agent', AgentRegistry],
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolRegistry],
    ['dsh-rws-tarot', tarot],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  for (const entry of ctx.loader.entries()) await entry.fiber?.await()
  return ctx
}

async function agentOf(ctx: Context): Promise<Agent> {
  const session = ctx.sessions.create(SessionId('tarot-loader'))
  const agent = {
    id: session.id, options: {}, session, status: 'idle', ctx: new Context(),
    followup: () => {}, send: () => {}, steer: () => {}, inject: () => {}, cancel: () => {},
    runMaintenance: (task: (s: AbortSignal) => unknown) => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  } as unknown as Agent
  await ctx.agents.register(agent)
  return agent
}

describe('rws-tarot booted through the real Loader from a cordis.yml', () => {
  it('registers the command and the tool, and lays a reading that follows its config', async () => {
    const ctx = await boot(['    defaultLanguage: zh', '    maxQuestion: 20'])
    expect(ctx.tools.schemas().some(s => s.name === 'tarot_lay_spread')).toBe(true)
    const agent = await agentOf(ctx)

    const result = await ctx.tools.execute({
      signal: new AbortController().signal, callId: ToolCallId('plain'), name: 'tarot_lay_spread',
      arguments: { method: 'plain', count: 2 }, agent,
    })
    expect(result.isError).toBe(false)
    const view = ctx.sessionProjections.snapshot(agent.session).values.tarot as tarot.TarotView
    expect(view.readings).toHaveLength(1)
    expect(view.readings[0]).toMatchObject({ method: 'plain', draws: 2, language: 'zh' })

    const execution = await ctx.commands.execute(agent, `/tarot start plain 1 upright en ${'x'.repeat(21)}`, [], new AbortController().signal)
    expect(execution?.result).toMatchObject({ kind: 'error' })
  }, 30_000)

  it('is removed with its fiber', async () => {
    const ctx = await boot([])
    expect(ctx.tools.schemas().some(s => s.name === 'tarot_lay_spread')).toBe(true)
    const entry = [...ctx.loader.entries()].find(e => e.options.name === 'dsh-rws-tarot')
    await entry?.fiber?.dispose()
    expect(entry).toBeDefined()
    expect(ctx.tools.schemas().some(s => s.name === 'tarot_lay_spread')).toBe(false)
  }, 30_000)

  it('fails loading when the config is not valid', async () => {
    await expect(boot(['    maxQuestion: "many"'])).rejects.toThrow(/maxQuestion/)
  }, 30_000)
})
