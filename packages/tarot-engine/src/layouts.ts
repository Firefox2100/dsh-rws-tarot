import { startPlain, type PlainStart } from './plain.ts'
import type { Rng } from './rng.ts'

/** Cards in each layout of modern practice; neither is a method of the book, and each is read a card at a time in this order. */
export const LAYOUT_SIZES = { three: 3, nine: 9 } as const
export type LayoutId = keyof typeof LAYOUT_SIZES

export function isLayout(id: string): id is LayoutId {
  return Object.hasOwn(LAYOUT_SIZES, id)
}

export interface LayoutOptions {
  readonly id: LayoutId
  readonly rng: Rng
  /** Chance each card is turned the other way up. */
  readonly reversals: number
}

/** Prepare a layout from the shuffled and cut pack: the whole pack in order, of which the first `draws` cards are turned up. */
export function startLayout(options: LayoutOptions): PlainStart {
  return startPlain({ count: LAYOUT_SIZES[options.id], rng: options.rng, reversals: options.reversals })
}
