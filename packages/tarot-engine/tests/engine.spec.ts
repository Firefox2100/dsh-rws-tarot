import { describe, expect, it } from 'vitest'
import { cryptoRng, fullDeck, Pack, randomInt, seededRng, subDeck, without } from '../src/index.ts'

const ids = (p: readonly { cardId: string }[]) => p.map(c => c.cardId)

describe('rng', () => {
  it('repeats a seed and separates seeds', () => {
    const a = Array.from({ length: 5 }, ((r) => () => r.next())(seededRng('x')))
    const b = Array.from({ length: 5 }, ((r) => () => r.next())(seededRng('x')))
    const c = Array.from({ length: 5 }, ((r) => () => r.next())(seededRng('y')))
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
    expect(seededRng(1).next()).toBe(seededRng('1').next())
  })

  it('stays in [0, 1) and spreads evenly', () => {
    for (const rng of [seededRng('range'), cryptoRng()]) {
      const bins = new Array(10).fill(0)
      for (let i = 0; i < 20000; i++) {
        const v = rng.next()
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(1)
        bins[Math.floor(v * 10)]++
      }
      for (const n of bins) expect(Math.abs(n - 2000)).toBeLessThan(200)
    }
  })

  it('draws integers below max and refuses a bad max', () => {
    const rng = seededRng('int')
    for (let i = 0; i < 1000; i++) expect(randomInt(rng, 78)).toBeLessThan(78)
    expect(() => randomInt(rng, 0)).toThrow(RangeError)
    expect(() => randomInt(rng, 1.5)).toThrow(RangeError)
  })
})

describe('decks', () => {
  it('lists the 78 cards in the book order', () => {
    const d = fullDeck()
    expect(d).toHaveLength(78)
    expect(d[0]).toBe('major-00')
    expect(d[21]).toBe('major-21')
    expect(d[22]).toBe('wands-01')
    expect(d[77]).toBe('pentacles-14')
  })

  it('builds sub-decks in book order and refuses unknown or repeated cards', () => {
    expect(subDeck(['wands-02', 'major-01'])).toEqual(['major-01', 'wands-02'])
    expect(() => subDeck(['nope'])).toThrow(RangeError)
    expect(() => subDeck(['major-01', 'major-01'])).toThrow(RangeError)
  })

  it('removes cards that are in the deck', () => {
    expect(without(fullDeck(), ['major-00'])).toHaveLength(77)
    expect(() => without(subDeck(['major-01']), ['major-02'])).toThrow(RangeError)
  })
})

describe('Pack', () => {
  it('shuffles all 78 cards without loss or repeat, and draws the next n in order', () => {
    const pack = Pack.seeded('s', { reversals: 0 })
    const first = pack.draw(3)
    const next = pack.draw(5)
    expect(first.map(c => c.index)).toEqual([0, 1, 2])
    expect(next.map(c => c.index)).toEqual([3, 4, 5, 6, 7])
    expect(pack.remaining).toBe(70)
    const rest = pack.draw(70)
    const all = [...first, ...next, ...rest]
    expect(new Set(ids(all))).toEqual(new Set(fullDeck()))
    expect(pack.drawn).toHaveLength(78)
    expect(pack.remaining).toBe(0)
  })

  it('is reproducible from deck, seed and reversals, and differs by seed', () => {
    const a = Pack.seeded('same', { reversals: 0.5 }).draw(78)
    const b = Pack.seeded('same', { reversals: 0.5 }).draw(78)
    const c = Pack.seeded('other', { reversals: 0.5 }).draw(78)
    expect(a).toEqual(b)
    expect(ids(a)).not.toEqual(ids(c))
  })

  it('draws only from a sub-deck', () => {
    const deck = subDeck(Array.from({ length: 22 }, (_, i) => `major-${String(i).padStart(2, '0')}`))
    const pack = Pack.seeded(7, { deck, reversals: 0 })
    expect(pack.remaining).toBe(22)
    expect(new Set(ids(pack.draw(22)))).toEqual(new Set(deck))
  })

  it('leaves the pack untouched when asked for more than remains or for a bad n', () => {
    const pack = Pack.seeded(1, { deck: subDeck(['major-00', 'major-01', 'major-02']), reversals: 0 })
    pack.draw(2)
    expect(() => pack.draw(2)).toThrow(RangeError)
    expect(pack.remaining).toBe(1)
    expect(() => pack.draw(-1)).toThrow(RangeError)
    expect(() => pack.draw(0.5)).toThrow(RangeError)
    expect(pack.draw(0)).toEqual([])
    expect(pack.draw(1)).toHaveLength(1)
  })

  it('turns no card with reversals 0, all with 1, about half with 0.5', () => {
    expect(Pack.seeded('r0', { reversals: 0 }).draw(78).some(c => c.reversed)).toBe(false)
    expect(Pack.seeded('r1', { reversals: 1 }).draw(78).every(c => c.reversed)).toBe(true)
    let reversed = 0
    for (let i = 0; i < 100; i++) reversed += Pack.seeded(`h${i}`, { reversals: 0.5 }).draw(78).filter(c => c.reversed).length
    expect(Math.abs(reversed / 7800 - 0.5)).toBeLessThan(0.02)
  })

  it('refuses a bad reversal chance, a repeated card and an unknown card', () => {
    expect(() => Pack.seeded(1, { reversals: 2 })).toThrow(RangeError)
    expect(() => Pack.seeded(1, { reversals: Number.NaN })).toThrow(RangeError)
    expect(() => Pack.seeded(1, { deck: ['major-00', 'major-00'], reversals: 0 })).toThrow(RangeError)
    expect(() => Pack.seeded(1, { deck: ['bogus'], reversals: 0 })).toThrow(RangeError)
  })

  it('gives every card an equal chance at the top (uniform first card)', () => {
    const counts = new Map<string, number>()
    const trials = 7800
    for (let i = 0; i < trials; i++) {
      const id = Pack.seeded(`u${i}`, { reversals: 0 }).draw(1)[0]!.cardId
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    expect(counts.size).toBe(78)
    for (const n of counts.values()) expect(Math.abs(n - 100)).toBeLessThan(45)
  })

  it('cuts without losing cards, by given position or at random', () => {
    const pack = Pack.seeded('cut', { reversals: 0, shuffle: false })
    const before = ids(pack.undrawn)
    pack.cut(10)
    expect(ids(pack.undrawn)).toEqual([...before.slice(10), ...before.slice(0, 10)])
    pack.cut()
    expect(new Set(ids(pack.undrawn))).toEqual(new Set(before))
    expect(() => pack.cut(0)).toThrow(RangeError)
    expect(() => pack.cut(78)).toThrow(RangeError)
    pack.draw(77)
    expect(() => pack.cut()).toThrow(RangeError)
  })

  it('shuffles and cuts only what has not been drawn', () => {
    const pack = Pack.seeded('part', { reversals: 0 })
    const drawn = pack.draw(5)
    const rest = new Set(ids(pack.undrawn))
    pack.shuffle()
    pack.cut()
    pack.turnSome(1)
    expect(pack.drawn).toEqual(drawn)
    expect(new Set(ids(pack.undrawn))).toEqual(rest)
    expect(pack.undrawn.every(c => c.reversed)).toBe(true)
  })

  it('takes a named card out of the undrawn cards', () => {
    const pack = Pack.seeded('take', { reversals: 0 })
    const top = pack.draw(2)
    const taken = pack.take('wands-14')
    expect(taken.cardId).toBe('wands-14')
    expect(pack.remaining).toBe(75)
    expect(pack.undrawn.map(c => c.cardId)).not.toContain('wands-14')
    expect(pack.drawn).toEqual(top)
    expect(() => pack.take('wands-14')).toThrow(RangeError)
    expect(() => pack.take(top[0]!.cardId)).toThrow(RangeError)
  })

  it('restores a snapshot and keeps drawing as the original would', () => {
    const original = Pack.seeded('snap', { reversals: 0.5 })
    original.draw(10)
    const copy = Pack.restore(JSON.parse(JSON.stringify(original.snapshot())), seededRng('unused'))
    expect(copy.drawn).toEqual(original.drawn)
    expect(copy.draw(20)).toEqual(original.draw(20))
    expect(copy.snapshot()).toEqual(original.snapshot())
  })

  it('refuses a damaged snapshot', () => {
    const good = Pack.seeded('bad', { reversals: 0 }).snapshot()
    expect(() => Pack.restore({ ...good, drawn: 99 }, seededRng(1))).toThrow(RangeError)
    expect(() => Pack.restore({ ...good, drawn: -1 }, seededRng(1))).toThrow(RangeError)
    expect(() => Pack.restore({ order: [good.order[0]!, good.order[0]!], drawn: 0 }, seededRng(1))).toThrow(RangeError)
    expect(() => Pack.restore({ order: [{ cardId: 'bogus', reversed: false }], drawn: 0 }, seededRng(1))).toThrow(RangeError)
  })

  it('does not let callers mutate its state through returned values', () => {
    const pack = Pack.seeded('iso', { reversals: 0 })
    const snap = pack.snapshot()
    ;(snap.order as unknown as { cardId: string }[])[0]!.cardId = 'x'
    ;(pack.undrawn as unknown as { cardId: string }[])[0]!.cardId = 'x'
    expect(pack.undrawn[0]!.cardId).not.toBe('x')
    expect(pack.snapshot().order[0]!.cardId).not.toBe('x')
  })
})
