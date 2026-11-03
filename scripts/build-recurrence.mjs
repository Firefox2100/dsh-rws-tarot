// Builds packages/tarot-data/data/recurrence.json from the section on the recurrence of cards in the book transcription.
// Every phrase is copied from the book; nothing is composed here.
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lines = (await readFile(resolve(root, 'references/pictorial-key/text/03-part-3-the-outer-method-of-the-oracles.md'), 'utf8')).split('\n')
const out = resolve(root, 'packages/tarot-data/data/recurrence.json')

const RANKS = { Kings: 'king', Queens: 'queen', Knights: 'knight', Pages: 'page', Tens: 'ten', Nines: 'nine', Eights: 'eight', Sevens: 'seven', Sixes: 'six', Fives: 'five', Fours: 'four', Threes: 'three', Twos: 'two', Aces: 'ace' }
const start = lines.findIndex(l => l.startsWith('THE RECURRENCE OF CARDS IN DEALING'))
const end = lines.findIndex((l, i) => i > start && l.startsWith('THE ART OF TAROT DIVINATION'))
if (start < 0 || end < 0) throw new Error('the section on the recurrence of cards was not found')

const entries = []
let position = null
let page = Number(lines.slice(0, start).reverse().map(l => /^<!-- pdf-page (\d+) -->$/.exec(l)).find(Boolean)?.[1])
for (const line of lines.slice(start, end)) {
  const mark = /^<!-- pdf-page (\d+) -->$/.exec(line)
  if (mark) page = Number(mark[1])
  else if (line === '## In the Natural Position') position = 'natural'
  else if (line === '## Reversed') position = 'reversed'
  else if (/^\d /.test(line)) {
    if (position === null) throw new Error(`a recurrence before its heading: ${line}`)
    for (const part of line.split(';')) {
      const entry = part.trim()
      const separator = entry.indexOf(' = ')
      const [count, rank, extra] = entry.slice(0, separator).split(' ')
      const value = entry.slice(separator + 3)
      const means = value.endsWith('.') ? value.slice(0, -1) : value
      if (separator < 0 || extra !== undefined || !['4', '3', '2'].includes(count) || RANKS[rank] === undefined || means === '') throw new Error(`cannot read recurrence "${part}"`)
      entries.push({ rank: RANKS[rank], count: Number(count), position, text: `${count} ${rank} = ${means}`, means, pdfPage: page })
    }
  }
}
if (entries.length !== 14 * 3 * 2) throw new Error(`expected 84 recurrences, found ${entries.length}`)
await writeFile(out, JSON.stringify({ source: { part: 3, section: 5, title: 'The Recurrence of Cards in Dealing' }, entries }, null, 2) + '\n')
console.log(`wrote ${entries.length} recurrences to ${out}`)
