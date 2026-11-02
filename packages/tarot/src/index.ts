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
  applyAbandon, applyDraw, applyStart, continueAlternative, cryptoRng, describeTurn, emptyTable, PLAIN_LIMIT, significatorFor, startAlternative, startCeltic, startPlain, turnAt,
  type AbandonEvent, type DrawEvent, type Placed, type Reading, type StartEvent, type Table,
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
    /** The person ends the reading that is open. */
    'plugin:dsh-rws-tarot/abandon': AbandonEvent
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
const turns = zod.array(zod.number().int().min(1))
const readingBase = zod.object({
  id: zod.string(), method: zod.string(), significator: placed.nullable(), facing: zod.enum(['left', 'right']).nullable(),
  question: zod.string(), language: zod.string(), draws: zod.number().int().min(1), order: zod.array(placed),
})
// A record written before readings had turns of their own shows one card a turn.
const startRecord = readingBase.extend({ turns: turns.optional() })
const drawRecord = zod.object({ readingId: zod.string(), index: zod.number().int().min(0) })
const abandonRecord = zod.object({ readingId: zod.string() })
const reading = readingBase.extend({ turns, drawn: zod.number().int().min(0), abandoned: zod.boolean() })
const table = zod.object({ readings: zod.array(reading) })
const view = zod.object({
  readings: zod.array(readingBase.omit({ order: true }).extend({ turns, drawn: zod.array(placed), abandoned: zod.boolean() })),
})

const USAGE = '/tarot start celtic <significator-id> <left|right> <upright|reversed> <language> [question] | start alternative <male|female> <upright|reversed> <language> [question] | start plain <count> <upright|reversed> <language> [question] | continue [question] | draw | abandon'

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
    stateVersion: 7,
    stateSchema: table,
    init: () => emptyTable,
    apply: (state, event) => {
      const record = pluginRecordOf(event)
      if (record === undefined) return state
      if (record.type === 'plugin:dsh-rws-tarot/start') {
        const data = startRecord.safeParse(record.data)
        return data.success ? applyStart(state, { ...data.data, turns: data.data.turns ?? Array.from({ length: data.data.draws }, () => 1) }) : state
      }
      if (record.type === 'plugin:dsh-rws-tarot/draw') {
        const data = drawRecord.safeParse(record.data)
        return data.success ? applyDraw(state, data.data) : state
      }
      if (record.type === 'plugin:dsh-rws-tarot/abandon') {
        const data = abandonRecord.safeParse(record.data)
        return data.success ? applyAbandon(state, data.data) : state
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
    return last !== undefined && !last.abandoned && last.drawn < last.draws ? last : undefined
  }
  interface Common {
    reversed: boolean
    language: string
    question: string
  }
  type Begin =
    | (Common & { methodId: 'celtic', significatorId: string, facing: 'left' | 'right' })
    | (Common & { methodId: 'alternative', sex: 'male' | 'female' })
    | (Common & { methodId: 'plain', count: number })
    | (Pick<Common, 'question'> & { methodId: 'thirtyfive' })

  /** Lays a reading in the session: the one place a reading begins, for the person's command and the model's tool alike. @returns why it cannot, or null. */
  const begin = async (agent: Agent, input: Begin): Promise<string | null> => {
    if (input.methodId === 'celtic' && !hasCard(input.significatorId)) return `usage: ${USAGE}`
    if (input.methodId === 'plain' && !(Number.isInteger(input.count) && input.count >= 1 && input.count <= PLAIN_LIMIT)) return `draw 1 to ${PLAIN_LIMIT} cards`
    if (input.question.length > config.maxQuestion) return `the question is longer than ${config.maxQuestion} characters`
    if (openReading(agent) !== undefined) return 'a reading is already in progress'
    let language: string
    let prepared: { significator: Placed | null, facing: 'left' | 'right' | null, draws: number, turns: number[], order: Placed[] }
    if (input.methodId === 'thirtyfive') {
      // It carries on the reading just finished, in its language, with the cards that reading left over.
      const previous = tableOf(agent).readings.at(-1)
      if (previous?.method !== getMethod('thirtyfive').continues || previous.abandoned || previous.drawn < previous.draws) return 'there is no finished reading of the alternative method to carry further'
      language = previous.language
      prepared = { ...continueAlternative(previous, cryptoRng()), facing: null }
    } else {
      language = input.language
      const reversals = input.reversed ? config.reversedShare : 0
      if (input.methodId === 'celtic') prepared = startCeltic({ significatorId: input.significatorId, facing: input.facing, rng: cryptoRng(), reversals })
      else if (input.methodId === 'alternative') prepared = { ...startAlternative({ sex: input.sex, rng: cryptoRng(), reversals }), facing: null }
      else prepared = { ...startPlain({ count: input.count, rng: cryptoRng(), reversals }), facing: null }
    }
    appendPluginRecord(agent.session, 'plugin:dsh-rws-tarot/start', {
      id: randomUUID(), method: input.methodId, significator: prepared.significator, facing: prepared.facing,
      question: input.question, language, draws: prepared.draws, turns: prepared.turns, order: prepared.order,
    })
    await ctx.sessions.flush(agent.session)
    return null
  }

  ctx.commands.register({
    name: 'tarot',
    description: 'Draw tarot cards',
    input: { hint: 'start | continue | draw' },
    recordInput: false,
    handler: async ({ agent, rawInput }) => {
      const [verb, ...args] = rawInput.trim().split(/\s+/)
      const session = agent.session

      if (verb === '') return { kind: 'success', text: `Open the Tarot page of the right dock to draw cards, or ask for a reading in the conversation. From the composer: ${USAGE}` }

      if (verb === 'start') {
        const [methodId, ...rest] = args
        let input: Begin | undefined
        if (methodId === 'celtic') {
          const [significatorId, facing, orientation, language, ...asked] = rest
          if (significatorId !== undefined && language !== undefined && (facing === 'left' || facing === 'right') && (orientation === 'upright' || orientation === 'reversed')) {
            input = { methodId, significatorId, facing, reversed: orientation === 'reversed', language, question: asked.join(' ') }
          }
        } else if (methodId === 'alternative') {
          const [sex, orientation, language, ...asked] = rest
          if (language !== undefined && (sex === 'male' || sex === 'female') && (orientation === 'upright' || orientation === 'reversed')) {
            input = { methodId, sex, reversed: orientation === 'reversed', language, question: asked.join(' ') }
          }
        } else if (methodId === 'plain') {
          const [count, orientation, language, ...asked] = rest
          if (language !== undefined && /^\d+$/.test(count ?? '') && (orientation === 'upright' || orientation === 'reversed')) {
            input = { methodId, count: Number(count), reversed: orientation === 'reversed', language, question: asked.join(' ') }
          }
        }
        if (input === undefined) return { kind: 'error', text: `usage: ${USAGE}` }
        const failure = await begin(agent, input)
        return failure === null ? { kind: 'success', text: `${input.methodId === 'plain' ? 'Plain draw' : getMethod(input.methodId).name}: reading begun` } : { kind: 'error', text: failure }
      }

      if (verb === 'continue') {
        const failure = await begin(agent, { methodId: 'thirtyfive', question: args.join(' ') })
        return failure === null ? { kind: 'success', text: `${getMethod('thirtyfive').name}: reading begun` } : { kind: 'error', text: failure }
      }

      if (verb === 'abandon') {
        const current = openReading(agent)
        if (current === undefined) return { kind: 'error', text: 'no reading in progress' }
        appendPluginRecord(session, 'plugin:dsh-rws-tarot/abandon', { readingId: current.id })
        if (openReading(agent) !== undefined) throw new Error('rws-tarot: the reading was not ended')
        await ctx.sessions.flush(session)
        return { kind: 'success', text: `reading ended after ${current.drawn} of ${current.draws} cards` }
      }

      if (verb === 'draw') {
        const current = openReading(agent)
        if (current === undefined) return { kind: 'error', text: 'no reading in progress' }
        appendPluginRecord(session, 'plugin:dsh-rws-tarot/draw', { readingId: current.id, index: current.drawn })
        const after = openReading(agent) ?? tableOf(agent).readings.at(-1)
        if (after === undefined || after.drawn !== current.drawn + (turnAt(current, current.drawn)?.size ?? 0)) throw new Error('rws-tarot: the draw was not applied')
        agent.followup(createUserMessage({
          content: [{ type: 'text', text: describeTurn(after, current.drawn) }],
          source: { kind: 'rws-tarot' },
        }))
        await ctx.sessions.flush(session)
        return { kind: 'success', text: `${after.drawn} of ${after.draws} cards turned up` }
      }

      return { kind: 'error', text: `usage: ${USAGE}` }
    },
  })

  ctx.tools.register(defineTool({
    name: 'tarot_lay_spread',
    description: [
      'Lay out a tarot spread for the person you are talking with, when they ask for a reading and none is open.',
      'Layouts: "celtic" (the default, the Celtic Cross of ten cards, for a definite question); "alternative" (forty-two cards in six lines of seven, for when no definite question is asked and they want to hear generally about the course of their life); "plain" (a number of cards, from 1 to ${PLAIN_LIMIT}, each speaking for itself with no position, for a simple question or when they just want a few cards); and "thirtyfive", which carries a finished alternative reading further with the thirty-five cards left over, in six lines, when something remains doubtful or they want to go on.',
      'You do not choose or turn any card: the shuffle and the layout are done for you, and the person turns the cards on their own Tarot page, one at a time for the Celtic Cross and one line at a time for the two layouts of lines, one card at a time for a plain draw.',
      'Each card reaches you as it is turned, with its place and what it means; speak to it then. Never name a card that has not been turned.',
      'For the Celtic Cross, pick the Significator, the card that stands for the person or the matter, either from their description (sex, whether they are forty or over, colouring) or by naming a card. For the alternative layout give only their sex; for "plain" give the number of cards; for "thirtyfive" give nothing but, if they have one, their question.',
    ].join(' '),
    parameters: {
      method: { type: 'string', enum: ['celtic', 'alternative', 'plain', 'thirtyfive'], description: 'Which layout; celtic when omitted.' },
      question: { type: 'string', description: 'What the person asks, in their own words, or the period they want to hear about; omit when they asked nothing.' },
      sex: { type: 'string', enum: ['man', 'woman'], description: 'For a Significator that stands for a person, and for the alternative layout.' },
      age: { type: 'string', enum: ['under-forty', 'forty-or-over'], description: 'For a Significator that stands for a person.' },
      colouring: { type: 'string', enum: ['wands', 'cups', 'swords', 'pentacles'], description: 'The person\'s colouring: wands for very fair, cups for light brown, swords for hazel or grey eyes with dark brown hair, pentacles for very dark.' },
      card: { type: 'string', description: 'Instead of a person: the id of the card that stands for the matter, such as "major-16" or "cups-13".' },
      facing: { type: 'string', enum: ['left', 'right'], description: 'The side the Significator faces; left when unsure.' },
      reversed: { type: 'boolean', description: 'Whether some cards may come up reversed. The alternative layout turns some cards unless told otherwise; the Celtic Cross only when the person wants it.' },
      count: { type: 'number', description: `For a plain draw: how many cards, 1 to ${PLAIN_LIMIT}.` },
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
      render: (_args, value) => [{
        type: 'text',
        text: value.method === 'thirtyfive'
          ? `The ${value.cards} cards left over are laid in six lines of unequal length, to carry the reading further. Now wait: the person turns the lines one at a time, and each arrives as a message when turned. Tell the person to turn the first line on the Tarot page, and say nothing about any card until it has been turned.`
          : value.method === 'plain'
          ? `${value.cards} cards are drawn. Now wait: the person turns them one at a time, and each arrives as a message when turned. Tell the person to turn the first card on the Tarot page, and say nothing about any card until it has been turned.`
          : value.method === 'alternative'
          ? `The ${value.cards} cards are laid in six lines of seven, with ${value.significator} as the Querent's card. Now wait: the person turns the lines one at a time, and each arrives as a message when turned. Tell the person to turn the first line on the Tarot page, and say nothing about any card until it has been turned.`
          : `The Celtic Cross is laid, with ${value.significator} as the Significator. Now wait: the person turns its ${value.cards} cards one at a time, and each arrives as a message when turned. Tell the person to turn the first card on the Tarot page, and say nothing about any card until it has been turned.`,
      }],
    },
    async execute(args, exec) {
      const agent = exec.agent
      if (agent === undefined) throw new Error('a spread is laid for a conversation, and this call has none')
      const language = args.language ?? config.defaultLanguage
      const question = (args.question ?? '').replace(/\s+/g, ' ').trim()
      if (args.method === 'thirtyfive') {
        const failure = await begin(agent, { methodId: 'thirtyfive', question })
        if (failure !== null) throw new Error(failure)
        const method = getMethod('thirtyfive')
        const querent = tableOf(agent).readings.at(-1)!.significator!
        return { method: 'thirtyfive', significator: cardName(getCard(querent.cardId), language), cards: method.packets.sizes.reduce((a, b) => a + b, 0) }
      }
      if (args.method === 'plain') {
        const count = args.count ?? 3
        const failure = await begin(agent, { methodId: 'plain', count, reversed: args.reversed ?? false, language, question })
        if (failure !== null) throw new Error(failure)
        return { method: 'plain', significator: '', cards: count }
      }
      if (args.method === 'alternative') {
        if (args.sex === undefined) throw new Error('name the sex of the person: the alternative layout is read for a man or a woman')
        const sex = args.sex === 'man' ? 'male' : 'female'
        const failure = await begin(agent, { methodId: 'alternative', sex, reversed: args.reversed ?? true, language, question })
        if (failure !== null) throw new Error(failure)
        const method = getMethod('alternative')
        return { method: 'alternative', significator: cardName(getCard(sex === 'male' ? method.querent.male : method.querent.female), language), cards: method.dealing.packets * method.dealing.perPacket }
      }
      const significatorId = args.card ?? (
        args.sex !== undefined && args.age !== undefined && args.colouring !== undefined
          ? significatorFor({ sex: args.sex === 'man' ? 'male' : 'female', fortyOrOver: args.age === 'forty-or-over' }, args.colouring)
          : undefined
      )
      if (significatorId === undefined) throw new Error('name the Significator: either card, or sex, age and colouring together')
      const failure = await begin(agent, { methodId: 'celtic', significatorId, facing: args.facing ?? 'left', reversed: args.reversed ?? false, language, question })
      if (failure !== null) throw new Error(failure)
      return { method: 'celtic', significator: cardName(getCard(significatorId), language), cards: getMethod('celtic').positions.length }
    },
  }))
}
