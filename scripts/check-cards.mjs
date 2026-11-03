// Verifies packages/tarot-data/data/cards.json against the book transcription and the image files.
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(await readFile(resolve(root, 'packages/tarot-data/data/cards.json'), 'utf8'))
const textDir = resolve(root, 'references/pictorial-key/text')
const squash = s => s.toLowerCase().replace(/<!--.*?-->/g, '').replace(/[^\p{L}\p{N}]+/gu, '')
const corpus = squash((await Promise.all((await readdir(textDir)).sort((a, b) => a.localeCompare(b)).map(f => readFile(resolve(textDir, f), 'utf8')))).join('\n').replace(/!\[[^\]]*\]\([^)]*\)/g, ''))

const errors = []
const fail = m => errors.push(m)
const ids = new Set()
const counts = { major: 0, minor: 0 }
const gaps = []

for (const c of data.cards) {
  if (ids.has(c.id)) fail(`duplicate id ${c.id}`)
  ids.add(c.id)
  counts[c.arcana]++
  const buf = await readFile(resolve(root, c.image.file)).catch(() => null)
  if (!buf) fail(`${c.id}: image missing ${c.image.file}`)
  else if (createHash('sha256').update(buf).digest('hex') !== c.image.sha256) fail(`${c.id}: image sha256 differs`)
  const passages = [['pictorial', c.pictorial], ['traditional', c.traditional], ...c.meanings.map(m => [`${m.context}/${m.scenario}`, m])]
  for (const [label, p] of passages) {
    if (!p) continue
    if (!p.text.trim()) fail(`${c.id}: empty ${label}`)
    else if (!corpus.includes(squash(p.text))) fail(`${c.id}: ${label} is not in the book text`)
    if (!p.source?.pdfPages) fail(`${c.id}: ${label} has no source`)
  }
  const has = (context, scenario) => c.meanings.some(m => m.context === context && m.scenario === scenario)
  if (!c.pictorial) gaps.push(`${c.id}: no picture description`)
  if (!has('divinatory', 'upright')) gaps.push(`${c.id}: no divinatory upright`)
  if (!has('divinatory', 'reversed')) gaps.push(`${c.id}: no divinatory reversed`)
  if (c.arcana === 'major' && !c.traditional) gaps.push(`${c.id}: no traditional commentary (Part I)`)
}
for (const n of data.sectionNotes) if (!corpus.includes(squash(n.text))) fail(`note ${n.id} is not in the book text`)
if (counts.major !== 22 || counts.minor !== 56) fail(`expected 22 major and 56 minor cards, got ${counts.major} and ${counts.minor}`)

// The book numbers the Trumps in its summary list of divinatory meanings (Part III) and says how it treats the Fool and the World.
const partThreeFile = (await readdir(textDir)).find(f => f.startsWith('03-part-3'))
const partThree = await readFile(resolve(textDir, partThreeFile), 'utf8')
const summary = [...partThree.matchAll(/^(Zero|\d+)\\?\. (.+?)\.—/gm)].map(m => [m[1] === 'Zero' ? 0 : Number(m[1]), m[2]])
if (summary.length !== 22) fail(`expected 22 numbered Trumps in the summary list of Part III, found ${summary.length}`)
for (const [number, title] of summary) {
  const card = data.cards.find(c => c.arcana === 'major' && c.number === number)
  if (!card) fail(`the book's Trump ${number} (${title}) has no card`)
  else if (![card.name, card.printedTitle, ...card.aliases].some(n => n === title)) fail(`the book calls Trump ${number} "${title}", the data "${card.printedTitle}"`)
}
for (const sentence of ['I have taken care not to number the World or Universe otherwise than as 21', 'Wherever it ought to be put, the Zero is an unnumbered card']) {
  if (!corpus.includes(squash(sentence))) fail(`the book no longer says: ${sentence}`)
}

console.log(`${data.cards.length} cards checked`)
if (gaps.length) console.log(`Gaps in the book (left empty, not invented):\n  ${gaps.join('\n  ')}`)
if (errors.length) { console.error(`\n${errors.length} problem(s):\n  ${errors.join('\n  ')}`); process.exit(1) }
