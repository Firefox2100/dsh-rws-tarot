// Builds packages/tarot-data/data/cards.json from the book transcription in references/pictorial-key.
// Every text is copied from the book; nothing is composed here.
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const book = resolve(root, 'references/pictorial-key')
const out = resolve(root, 'packages/tarot-data/data/cards.json')

const SUITS = ['wands', 'cups', 'swords', 'pentacles']
const RANKS = [
  [1, 'ace', 'Ace'], [2, 'two', 'Two'], [3, 'three', 'Three'], [4, 'four', 'Four'], [5, 'five', 'Five'],
  [6, 'six', 'Six'], [7, 'seven', 'Seven'], [8, 'eight', 'Eight'], [9, 'nine', 'Nine'], [10, 'ten', 'Ten'],
  [11, 'page', 'Page'], [12, 'knight', 'Knight'], [13, 'queen', 'Queen'], [14, 'king', 'King'],
]
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18, XIX: 19, XX: 20, XXI: 21 }
const MARK = /^<!-- pdf-page (\d+) -->$/
const IMAGE = /^!\[[^\]]*\]\(\.\.\/images\/([^)]+)\)$/

const read = name => readFile(resolve(book, 'text', name), 'utf8').then(t => t.split('\n'))
const manifest = JSON.parse(await readFile(resolve(book, 'images/manifest.json'), 'utf8'))
const imageHashes = Object.fromEntries(await Promise.all(Object.entries(manifest).map(async ([file, value]) => [file, createHash('sha256').update(await readFile(resolve(book, value.path))).digest('hex')])))
const joins = []
const notes = []

const unescape = s => s.replace(/\\([\\`*_{}\[\]()#+\-.!~|<>$])/g, '$1').replace(/ +/g, ' ').trim()

/** Splits lines into paragraphs that remember the scan page they start on. A paragraph interrupted by a page break is rejoined. */
function paragraphs(lines, startPage) {
  const out = []
  let page = startPage
  let cur = null
  let blank = false
  let broke = false
  const flush = () => { if (cur) { out.push(cur); cur = null } }
  for (const raw of lines) {
    const text = raw.trim()
    const m = MARK.exec(text)
    if (m) { page = Number(m[1]); broke = true; continue }
    if (IMAGE.test(text)) { flush(); blank = false; broke = false; continue }
    if (text === '') { blank = true; continue }
    const starts = !cur || (blank && !broke)
    const newPara = cur && broke && !/^[a-z]/.test(text) && /[.!?:"”)\]*]$/.test(cur.text)
    if (starts || newPara) { flush(); cur = { page, last: page, text } }
    else if (cur && broke && /-$/.test(cur.text) && /^[a-z]/.test(text)) { cur.text = cur.text.slice(0, -1) + text; cur.last = page; joins.push(`${cur.text.slice(-40)} @${page}`) }
    else { cur.text += ' ' + text; cur.last = page }
    blank = false
    broke = false
  }
  flush()
  return out
}

const pageAt = (lines, index) => {
  for (let i = index; i >= 0; i--) { const m = MARK.exec(lines[i].trim()); if (m) return Number(m[1]) }
  return 0
}
const passage = ps => ps.length === 0 ? null : { text: unescape(ps.map(p => p.text).join('\n\n')), pdfPages: [ps[0].page, Math.max(...ps.map(p => p.last))] }

function blocks(lines, from, to) {
  const heads = []
  for (let i = from; i < to; i++) if (lines[i].startsWith('## ')) heads.push(i)
  return heads.map((h, k) => ({ title: lines[h].slice(3).trim(), line: h, body: lines.slice(h + 1, heads[k + 1] ?? to), start: h }))
}

const partOne = await read('01-part-1-the-veil-and-its-symbols.md')
const partTwo = await read('02-part-2-the-doctrine-behind-the-veil.md')
const partThree = await read('03-part-3-the-outer-method-of-the-oracles.md')
const idx = (lines, re, from = 0) => { const i = lines.findIndex((l, n) => n >= from && re.test(l)); if (i < 0) throw new Error(`missing ${re}`); return i }

// --- Part II: symbolism of the Trumps Major (heading preceded by its numeral)
const p2from = idx(partTwo, /^## The Magician/)
const p2to = idx(partTwo, /^## Conclusion as to the Greater Keys/)
const symbolism = new Map()
const p2blocks = blocks(partTwo, p2from, p2to)
for (const b of p2blocks) {
  const numeralLine = partTwo.slice(Math.max(0, b.line - 4), b.line).map(l => l.trim()).filter(l => l && !MARK.test(l)).pop() ?? ''
  const roman = numeralLine.replace(/[\s\\]+/g, '').replace(/ /g, '')
  const title = b.title.replace(/^Zero: /, '')
  const number = /^Zero/.test(b.title) ? 0 : ROMAN[roman]
  if (number === undefined) throw new Error(`no numeral for ${b.title} (${numeralLine})`)
  const body = [...b.body]
  while (body.length && (body.at(-1).trim() === '' || MARK.test(body.at(-1).trim()) || /^[IVXL]+$/.test(body.at(-1).replace(/[\s\\]+/g, '')))) body.pop()
  symbolism.set(number, { title, pass: passage(paragraphs(body, pageAt(partTwo, b.line))), pdfStart: pageAt(partTwo, b.line) })
}

// --- Part I: traditional commentary, one numbered entry per Trump
const p1from = idx(partOne, /^\*\*TRUMPS MAJOR\*\*/)
const p1to = idx(partOne, /^CLASS II/, p1from)
const traditional = new Map()
{
  const ps = paragraphs(partOne.slice(p1from + 1, p1to), pageAt(partOne, p1from))
  let current = null
  for (const p of ps) {
    // Part I numbers the cards in the older order: the Fool is "21—" and the World "22."
    const m = /^(\d+)(?:\\?\.\s|—)/.exec(p.text)
    if (m) { const n = Number(m[1]); current = { number: n === 21 ? 0 : n === 22 ? 21 : n, ps: [p] }; traditional.set(current.number, current) }
    else if (current && !/^\*\*/.test(p.text)) current.ps.push(p)
  }
  for (const v of traditional.values()) v.pass = passage(v.ps)
}

// --- Part III §3: divinatory meanings of the Trumps Major
const g3from = idx(partThree, /^THE GREATER ARCANA AND THEIR DIVINATORY MEANINGS/)
const g3to = idx(partThree, /^It will be seen that/, g3from)
const greater = new Map()
{
  const ps = paragraphs(partThree.slice(g3from + 1, g3to), pageAt(partThree, g3from))
  for (const p of ps) {
    const m = /^(?:(\d+)\\?\.|Zero\.) ([^.]+?)\.—(.*)$/s.exec(p.text)
    if (!m) throw new Error(`greater arcana entry: ${p.text.slice(0, 60)}`)
    const number = m[1] === undefined ? 0 : Number(m[1])
    const rev = /\*Revers(?:ed|e)[:;.]?\*|\*Reversed\*[:;.]?/.exec(m[3])
    greater.set(number, {
      name: m[2],
      upright: passage([{ ...p, text: (rev ? m[3].slice(0, rev.index) : m[3]).trim() }]),
      reversed: rev ? passage([{ ...p, text: m[3].slice(rev.index + rev[0].length).trim() }]) : null,
    })
  }
}

// --- Part III §2: picture and divinatory meanings of the Lesser Arcana
const l2from = idx(partThree, /^## The Suit Of Wands: King/)
const l2to = idx(partThree, /^§ 3/, l2from)
const lesser = new Map()
for (const b of blocks(partThree, l2from, l2to)) {
  const m = /^(?:The Suit Of )?(Wands|Cups|Swords|Pentacles): (\w+)$/.exec(b.title)
  if (!m) throw new Error(`lesser heading ${b.title}`)
  const suit = m[1].toLowerCase()
  const rank = RANKS.find(r => r[2] === m[2])
  const image = b.body.map(l => IMAGE.exec(l.trim())).find(Boolean)
  const imageAt = b.body.findIndex(l => IMAGE.test(l.trim()))
  const textLines = b.body.slice(0, imageAt >= 0 ? imageAt : undefined)
  const trailing = imageAt >= 0 ? b.body.slice(imageAt + 1) : []
  const ps = paragraphs(textLines, pageAt(partThree, b.line))
  const full = ps.map(p => p.text).join('\n\n')
  const div = /\*Divinatory Meanings:?\*:?/.exec(full)
  const rev = /\*Revers(?:ed|e)[:;.]?\*[:;.]?/.exec(full)
  const span = (a, z) => passage([{ text: full.slice(a, z).trim(), page: ps[0].page, last: ps.at(-1).last }])
  lesser.set(`${suit}-${rank[0]}`, {
    image: image?.[1],
    pictorial: div ? span(0, div.index) : span(0, undefined),
    upright: div ? span(div.index + div[0].length, rev?.index) : null,
    reversed: rev ? span(rev.index + rev[0].length) : null,
  })
  for (const p of paragraphs(trailing, pageAt(partThree, b.line + imageAt))) notes.push({ id: 'lesser-arcana-remark', ...p })
}

// --- Part III §4: additional meanings of the Lesser Arcana
const a4from = idx(partThree, /^SOME ADDITIONAL MEANINGS OF THE LESSER ARCANA/)
const a4to = idx(partThree, /^§ 5/, a4from)
const additional = new Map()
{
  const ps = paragraphs(partThree.slice(a4from + 1, a4to), pageAt(partThree, a4from))
  let suit
  let last
  for (const p of ps) {
    if (/^It will be observed/.test(p.text)) { notes.push({ id: 'additional-meanings-remark', ...p }); break }
    const sm = /^(Wands|Cups|Swords|Pentacles)\. /.exec(p.text)
    if (sm) { suit = sm[1].toLowerCase(); p.text = p.text.slice(sm[0].length) }
    const m = /^\*(\w+)\*\.—(.*)$/s.exec(p.text)
    if (!m) { if (last) { last.ps.push(p); continue } throw new Error(`additional entry: ${p.text.slice(0, 60)}`) }
    const rank = RANKS.find(r => r[2] === m[1])
    if (!rank) throw new Error(`additional rank ${m[1]}`)
    last = { key: `${suit}-${rank[0]}`, ps: [{ ...p, text: m[2] }] }
    additional.set(last.key, last)
  }
  for (const v of additional.values()) {
    const full = v.ps.map(p => p.text).join('\n\n')
    const rev = /\*Revers(?:ed|e)[:;.]?\*[:;.]?/.exec(full)
    const mk = (a, z) => { const t = full.slice(a, z).trim(); return t ? passage([{ text: t, page: v.ps[0].page, last: v.ps.at(-1).last }]) : null }
    v.upright = mk(0, rev?.index)
    v.reversed = rev ? mk(rev.index + rev[0].length) : null
  }
}

// --- assemble
const imageRecord = file => {
  const m = manifest[file]
  if (!m) throw new Error(`image ${file} not in manifest`)
  return { file: `references/pictorial-key/${m.path}`, width: m.w, height: m.h, sha256: imageHashes[file], source: 'The Pictorial Key to the Tarot (1910/1922) plate, via Wikimedia Commons' }
}
const meaning = (scenario, context, pass, section) => pass && { scenario, context, text: pass.text, source: { part: 3, section, pdfPages: pass.pdfPages } }
const cards = []

for (let n = 0; n <= 21; n++) {
  const s = symbolism.get(n)
  const t = traditional.get(n)
  const g = greater.get(n)
  const file = Object.keys(manifest).find(f => f.startsWith(`Pictorial_Key_to_the_Tarot_${String(n).padStart(2, '0')}_`))
  cards.push({
    id: `major-${String(n).padStart(2, '0')}`,
    arcana: 'major',
    number: n,
    suit: null,
    rank: null,
    name: s.title.split(/, or /)[0],
    aliases: [...new Set([...s.title.split(/, or /).slice(1), g.name])].filter(a => a !== s.title.split(/, or /)[0]),
    printedTitle: s.title,
    image: imageRecord(file),
    pictorial: s.pass && { text: s.pass.text, source: { part: 2, section: 'The Trumps Major and their Inner Symbolism', pdfPages: s.pass.pdfPages } },
    traditional: t?.pass ? { text: t.pass.text, source: { part: 1, section: '§ 2 Trumps Major', pdfPages: t.pass.pdfPages } } : null,
    meanings: [
      meaning('upright', 'divinatory', g.upright, '§ 3 The Greater Arcana and their Divinatory Meanings'),
      meaning('reversed', 'divinatory', g.reversed, '§ 3 The Greater Arcana and their Divinatory Meanings'),
    ].filter(Boolean),
  })
}

for (const suit of SUITS) {
  for (const [n, rank, label] of RANKS) {
    const l = lesser.get(`${suit}-${n}`)
    const a = additional.get(`${suit}-${n}`)
    if (!l) throw new Error(`no lesser ${suit} ${n}`)
    const Suit = suit[0].toUpperCase() + suit.slice(1)
    cards.push({
      id: `${suit}-${String(n).padStart(2, '0')}`,
      arcana: 'minor',
      number: n,
      suit,
      rank,
      name: `${label} of ${Suit}`,
      printedTitle: `${Suit}: ${label}`,
      image: imageRecord(l.image),
      pictorial: l.pictorial && { text: l.pictorial.text, source: { part: 3, section: '§ 2 The Lesser Arcana', pdfPages: l.pictorial.pdfPages } },
      traditional: null,
      meanings: [
        meaning('upright', 'divinatory', l.upright, '§ 2 The Lesser Arcana'),
        meaning('reversed', 'divinatory', l.reversed, '§ 2 The Lesser Arcana'),
        meaning('upright', 'additional', a?.upright, '§ 4 Some Additional Meanings of the Lesser Arcana'),
        meaning('reversed', 'additional', a?.reversed, '§ 4 Some Additional Meanings of the Lesser Arcana'),
      ].filter(Boolean),
    })
  }
}

// The transcription marks italics with asterisks; the data keeps the words only.
await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify({
  book: { title: 'The Pictorial Key to the Tarot', author: 'Arthur Edward Waite', illustrator: 'Pamela Colman Smith', year: '1910/1922', pageNote: 'pdfPages are indexes into references/pictorial-key/source/The_Pictorial_Key_to_the_Tarot.pdf as numbered by the transcription; the printed page number is the index minus 13 inside the main text.' },
  sectionNotes: notes.map(n => ({ id: n.id, text: unescape(n.text), source: { part: 3, pdfPages: [n.page, n.last] } })),
  cards,
}, (key, value) => key === 'text' && typeof value === 'string' ? value.replace(/\*/g, '') : value, 2) + '\n')
console.log(`${cards.length} cards, ${joins.length} page-break hyphen joins`)
for (const j of joins) console.log('  join:', j)
