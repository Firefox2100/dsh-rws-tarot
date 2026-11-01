import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-projection'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { appendPluginRecord, pluginRecordOf } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { getCard, getMethod, hasCard, cardName } from '@dsh-rws-tarot/data'
import {
  applyDraw, applyStart, cryptoRng, describeCard, emptyTable, significatorFor, startCeltic,
  type DrawEvent, type Reading, type StartEvent, type Table,
} from '@dsh-rws-tarot/engine'
import z from '@deepseek-ai/schemastery'
import { z as zod } from 'zod'
import { registerPlates } from './plates.ts'
import type { TarotView } from './types.ts'

export type { ReadingView, TarotView } from './types.ts'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    /** The facts of a reading, assembled from the book. */
    'rws-tarot': { kind: 'rws-tarot' }
  }
}

// Records, not SessionEventMap members: a session holding an event type unknown to the harness is refused on load, so
// a plugin outside the DSH repository keeps its state in ignorable `plugin:` records, which any harness skips.
declare module '@deepseek-ai/dsh-session/types' {
  interface PluginRecordMap {
    /** A reading begins, with the pack already shuffled and cut. */
    'plugin:dsh-rws-tarot/start': StartEvent
    /** The next card of a reading is turned up. */
    'plugin:dsh-rws-tarot/draw': DrawEvent
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    tarot: Table
  }
}

export const name = 'rws-tarot'
export const inject = ['commands', 'sessionProjections', 'sessions', 'tools']

const placed = zod.object({ cardId: zod.string(), reversed: zod.boolean() })
const startRecord = zod.object({
  id: zod.string(), method: zod.string(), significator: placed.nullable(), facing: zod.enum(['left', 'right']).nullable(),
  question: zod.string(), language: zod.string(), draws: zod.number().int().min(1), order: zod.array(placed),
})
const drawRecord = zod.object({ readingId: zod.string(), index: zod.number().int().min(0) })
const reading = startRecord.extend({ drawn: zod.number().int().min(0) })
const table = zod.object({ readings: zod.array(reading) })
const view = zod.object({
  readings: zod.array(startRecord.omit({ order: true }).extend({ drawn: zod.array(placed) })),
})

const USAGE = '/tarot start celtic <significator-id> <left|right> <upright|reversed> <language> [question] | draw'

export interface Config {
  /** The language of the facts for a reading the model begins, when it names none. */
  defaultLanguage: string
  /** Share of the cards that lie reversed when the person turns reversals on. */
  reversedShare: number
  /** A question longer than this is refused, not cut: the person should see what was asked. */
  maxQuestion: number
}

export const Config: z<Config> = z.object({
  defaultLanguage: z.string().default('en'),
  reversedShare: z.number().min(0).max(1).default(0.5),
  maxQuestion: z.natural().default(500),
})

export function apply(ctx: Context, config: Config): void {
  registerPlates(ctx)

  ctx.sessionProjections.register({
    key: 'tarot',
    stateVersion: 4,
    stateSchema: table,
    init: () => emptyTable,
    apply: (state, event) => {
      const record = pluginRecordOf(event)
      if (record === undefined) return state
      if (record.type === 'plugin:dsh-rws-tarot/start') {
        const data = startRecord.safeParse(record.data)
        return data.success ? applyStart(state, data.data) : state
      }
      if (record.type === 'plugin:dsh-rws-tarot/draw') {
        const data = drawRecord.safeParse(record.data)
        return data.success ? applyDraw(state, data.data) : state
      }
      return state
    },
    wire: {
      viewSchema: view,
      view: (state): TarotView => ({
        readings: state.readings.map(({ order, drawn, ...rest }) => ({ ...rest, drawn: order.slice(0, drawn) })),
      }),
    },
  })

  const tableOf = (agent: Agent): Table => ctx.sessionProjections.stateOf(agent.session, 'tarot') ?? emptyTable
  const openReading = (agent: Agent): Reading | undefined => {
    const last = tableOf(agent).readings.at(-1)
    return last !== undefined && last.drawn < last.draws ? last : undefined
  }
  interface Begin {
    methodId: string
    significatorId: string
    facing: 'left' | 'right'
    reversed: boolean
    language: string
    question: string
  }

  /** Lays a reading in the session: the one place a reading begins, for the person's command and the model's tool alike. @returns why it cannot, or null. */
  const begin = async (agent: Agent, input: Begin): Promise<string | null> => {
    if (input.methodId !== 'celtic' || !hasCard(input.significatorId)) return `usage: ${USAGE}`
    if (input.question.length > config.maxQuestion) return `the question is longer than ${config.maxQuestion} characters`
    if (openReading(agent) !== undefined) return 'a reading is already in progress'
    const prepared = startCeltic({ significatorId: input.significatorId, facing: input.facing, rng: cryptoRng(), reversals: input.reversed ? config.reversedShare : 0 })
    appendPluginRecord(agent.session, 'plugin:dsh-rws-tarot/start', {
      id: randomUUID(), method: input.methodId, significator: prepared.significator, facing: prepared.facing,
      question: input.question, language: input.language, draws: prepared.draws, order: prepared.order,
    })
    await ctx.sessions.flush(agent.session)
    return null
  }

  ctx.commands.register({
    name: 'tarot',
    description: 'Draw tarot cards',
    input: { hint: 'start | draw' },
    recordInput: false,
    handler: async ({ agent, rawInput }) => {
      const [verb, ...args] = rawInput.trim().split(/\s+/)
      const session = agent.session

      if (verb === '') return { kind: 'success', text: `Open the Tarot page of the right dock to draw cards, or ask for a reading in the conversation. From the composer: ${USAGE}` }

      if (verb === 'start') {
        const [methodId, significatorId, facing, orientation, language, ...asked] = args
        if (methodId === undefined || significatorId === undefined || language === undefined) return { kind: 'error', text: `usage: ${USAGE}` }
        if (facing !== 'left' && facing !== 'right') return { kind: 'error', text: `usage: ${USAGE}` }
        if (orientation !== 'upright' && orientation !== 'reversed') return { kind: 'error', text: `usage: ${USAGE}` }
        const failure = await begin(agent, { methodId, significatorId, facing, reversed: orientation === 'reversed', language, question: asked.join(' ') })
        return failure === null ? { kind: 'success', text: `${getMethod(methodId).name}: reading begun` } : { kind: 'error', text: failure }
      }

      if (verb === 'draw') {
        const current = openReading(agent)
        if (current === undefined) return { kind: 'error', text: 'no reading in progress' }
        appendPluginRecord(session, 'plugin:dsh-rws-tarot/draw', { readingId: current.id, index: current.drawn })
        const after = openReading(agent) ?? tableOf(agent).readings.at(-1)
        if (after === undefined || after.drawn !== current.drawn + 1) throw new Error('rws-tarot: the draw was not applied')
        agent.followup(createUserMessage({
          content: [{ type: 'text', text: describeCard(after, current.drawn) }],
          source: { kind: 'rws-tarot' },
        }))
        await ctx.sessions.flush(session)
        return { kind: 'success', text: `card ${after.drawn} of ${after.draws} turned up` }
      }

      return { kind: 'error', text: `usage: ${USAGE}` }
    },
  })

  ctx.tools.register(defineTool({
    name: 'tarot_lay_spread',
    description: [
      'Lay out a Celtic Cross tarot spread for the person you are talking with, when they ask for a reading and none is open.',
      'You do not choose or turn any card: the shuffle and the layout are done for you, and the person turns the cards one at a time on their own Tarot page.',
      'Each card reaches you as it is turned, with its position and what it means; speak to that card then. Never name a card that has not been turned.',
      'Pick the Significator, the card that stands for the person or the matter, either from their description (sex, whether they are forty or over, colouring) or by naming a card.',
    ].join(' '),
    parameters: {
      question: { type: 'string', description: 'What the person asks, in their own words; omit when they asked nothing.' },
      sex: { type: 'string', enum: ['man', 'woman'], description: 'For a Significator that stands for a person.' },
      age: { type: 'string', enum: ['under-forty', 'forty-or-over'], description: 'For a Significator that stands for a person.' },
      colouring: { type: 'string', enum: ['wands', 'cups', 'swords', 'pentacles'], description: 'The person\'s colouring: wands for very fair, cups for light brown, swords for hazel or grey eyes with dark brown hair, pentacles for very dark.' },
      card: { type: 'string', description: 'Instead of a person: the id of the card that stands for the matter, such as "major-16" or "cups-13".' },
      facing: { type: 'string', enum: ['left', 'right'], description: 'The side the Significator faces; left when unsure.' },
      reversed: { type: 'boolean', description: 'Whether some cards may come up reversed; only when the person wants it.' },
      language: { type: 'string', description: 'The language of the conversation, such as "en" or "zh", so the cards reach you in it; omit for the default.' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          method: { type: 'string', required: true },
          significator: { type: 'string', required: true },
          cards: { type: 'number', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `The Celtic Cross is laid, with ${value.significator} as the Significator. Now wait: the person turns its ${value.cards} cards one at a time, and each arrives as a message when turned. Tell the person to turn the first card on the Tarot page, and say nothing about any card until it has been turned.` }],
    },
    async execute(args, exec) {
      const agent = exec.agent
      if (agent === undefined) throw new Error('a spread is laid for a conversation, and this call has none')
      const language = args.language ?? config.defaultLanguage
      const significatorId = args.card ?? (
        args.sex !== undefined && args.age !== undefined && args.colouring !== undefined
          ? significatorFor({ sex: args.sex === 'man' ? 'male' : 'female', fortyOrOver: args.age === 'forty-or-over' }, args.colouring)
          : undefined
      )
      if (significatorId === undefined) throw new Error('name the Significator: either card, or sex, age and colouring together')
      const failure = await begin(agent, { methodId: 'celtic', significatorId, facing: args.facing ?? 'left', reversed: args.reversed ?? false, language, question: (args.question ?? '').replace(/\s+/g, ' ').trim() })
      if (failure !== null) throw new Error(failure)
      return { method: 'celtic', significator: cardName(getCard(significatorId), language), cards: getMethod('celtic').positions.length }
    },
  }))
}
